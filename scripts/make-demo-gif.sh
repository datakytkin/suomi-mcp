#!/usr/bin/env bash
# Muuntaa ruutunauhoituksen (mov/mp4) optimoiduksi README-GIF:ksi.
#
# Käyttö:
#   scripts/make-demo-gif.sh demo.mov [alku] [kesto]
#   scripts/make-demo-gif.sh demo.mov 00:00:03 25      # leikkaa 3 s kohdasta, 25 s
#
# Säädöt ympäristömuuttujilla:  FPS=10 WIDTH=900 SPEED=2 scripts/make-demo-gif.sh demo.mov
#   SPEED>1 nopeuttaa (hyvä pitkän nauhoituksen tiivistämiseen / odotusten yli)
#
# Tulos: .github/assets/demo.gif
#
# Vaatii: ffmpeg  (brew install ffmpeg)
# Valinnainen: gifski  (brew install gifski) – parempi laatu; muuten ffmpeg-fallback.

set -eo pipefail

SRC="${1:?anna lähdetiedosto, esim. demo.mov}"
START="${2:-}"
DURATION="${3:-}"

FPS="${FPS:-12}"
WIDTH="${WIDTH:-1000}"
SPEED="${SPEED:-1}"
OUT_DIR=".github/assets"
OUT="$OUT_DIR/demo.gif"

command -v ffmpeg >/dev/null 2>&1 || { echo "ffmpeg puuttuu: brew install ffmpeg"; exit 1; }
[ -f "$SRC" ] || { echo "Tiedostoa ei löydy: $SRC"; exit 1; }

FRAMES_DIR="$(mktemp -d)"
trap 'rm -rf "$FRAMES_DIR"' EXIT
mkdir -p "$OUT_DIR"

# Leikkausargumentit (tyhjä jos alkua/kestoa ei annettu). Käytetään turvallista
# taulukkolaajennusta jotta toimii myös macOS:n bash 3.2:lla (set -u -turva).
CLIP_ARGS=()
[ -n "$START" ] && CLIP_ARGS+=(-ss "$START")
[ -n "$DURATION" ] && CLIP_ARGS+=(-t "$DURATION")

# setpts nopeuttaa/hidastaa; PTS-kerroin = 1/SPEED
PTS=$(awk "BEGIN{printf \"%.5f\", 1/${SPEED}}")
SCALE="setpts=${PTS}*PTS,fps=${FPS},scale=${WIDTH}:-1:flags=lanczos"

if command -v gifski >/dev/null 2>&1; then
  echo "1/2  Poimitaan ruudut ($FPS fps, leveys $WIDTH)…"
  ffmpeg -hide_banner -loglevel error ${CLIP_ARGS[@]+"${CLIP_ARGS[@]}"} -i "$SRC" \
    -vf "$SCALE" "$FRAMES_DIR/frame_%04d.png"
  echo "2/2  Koodataan GIF (gifski)…"
  gifski --fps "$FPS" --quality 80 --width "$WIDTH" -o "$OUT" "$FRAMES_DIR"/frame_*.png
else
  echo "gifski ei asennettu -> ffmpeg palettegen -fallback (brew install gifski parantaa laatua)"
  echo "1/2  Rakennetaan väripaletti…"
  ffmpeg -y -hide_banner -loglevel error ${CLIP_ARGS[@]+"${CLIP_ARGS[@]}"} -i "$SRC" \
    -vf "${SCALE},palettegen=stats_mode=diff" "$FRAMES_DIR/palette.png"
  echo "2/2  Koodataan GIF…"
  ffmpeg -y -hide_banner -loglevel error ${CLIP_ARGS[@]+"${CLIP_ARGS[@]}"} -i "$SRC" -i "$FRAMES_DIR/palette.png" \
    -lavfi "${SCALE}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" "$OUT"
fi

SIZE_KB=$(du -k "$OUT" | cut -f1)
echo
echo "Valmis: $OUT  ($(du -h "$OUT" | cut -f1))"
if [ "$SIZE_KB" -gt 8192 ]; then
  echo "⚠  Yli 8 MB – aja uudelleen esim.  FPS=10 WIDTH=860 $0 $SRC  tai lyhennä klippiä."
fi
echo
echo "Esikatsele, sitten:"
echo "  git add $OUT README.md && git commit -m \"Lisää demo-GIF README:hin\" && git push"
