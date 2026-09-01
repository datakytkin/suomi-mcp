#!/usr/bin/env bash
# Muuntaa ruutunauhoituksen (mov/mp4) optimoiduksi README-GIF:ksi.
#
# Käyttö:
#   scripts/make-demo-gif.sh demo.mov [alku] [kesto]
#   scripts/make-demo-gif.sh demo.mov 00:00:03 25      # leikkaa 3 s kohdasta, 25 s
#
# Tulos: .github/assets/demo.gif
#
# Vaatii: ffmpeg  (brew install ffmpeg)
# Valinnainen: gifski  (brew install gifski) – parempi laatu; muuten ffmpeg-fallback.

set -euo pipefail

SRC="${1:?anna lähdetiedosto, esim. demo.mov}"
START="${2:-}"
DURATION="${3:-}"

FPS=12
WIDTH=1000
OUT_DIR=".github/assets"
OUT="$OUT_DIR/demo.gif"
FRAMES_DIR="$(mktemp -d)"
trap 'rm -rf "$FRAMES_DIR"' EXIT

mkdir -p "$OUT_DIR"

CLIP_ARGS=()
[ -n "$START" ] && CLIP_ARGS+=(-ss "$START")
[ -n "$DURATION" ] && CLIP_ARGS+=(-t "$DURATION")

if command -v gifski >/dev/null 2>&1; then
  echo "1/2  Poimitaan ruudut ($FPS fps, leveys $WIDTH)…"
  ffmpeg -hide_banner -loglevel error \
    "${CLIP_ARGS[@]}" -i "$SRC" \
    -vf "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos" \
    "$FRAMES_DIR/frame_%04d.png"
  echo "2/2  Koodataan GIF (gifski)…"
  gifski --fps "$FPS" --quality 80 --width "$WIDTH" \
    -o "$OUT" "$FRAMES_DIR"/frame_*.png
else
  echo "gifski ei asennettu -> ffmpeg palettegen -fallback (brew install gifski parantaa laatua)"
  echo "1/2  Rakennetaan väripaletti…"
  ffmpeg -hide_banner -loglevel error \
    "${CLIP_ARGS[@]}" -i "$SRC" \
    -vf "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,palettegen=stats_mode=diff" \
    "$FRAMES_DIR/palette.png"
  echo "2/2  Koodataan GIF…"
  ffmpeg -hide_banner -loglevel error \
    "${CLIP_ARGS[@]}" -i "$SRC" -i "$FRAMES_DIR/palette.png" \
    -lavfi "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" \
    "$OUT"
fi

SIZE=$(du -h "$OUT" | cut -f1)
echo "Valmis: $OUT  ($SIZE)"
[ "$(du -k "$OUT" | cut -f1)" -gt 8192 ] && \
  echo "⚠  Yli 8 MB – lyhennä klippiä tai laske WIDTH/FPS skriptissä."
echo
echo "Esikatsele, sitten:"
echo "  git add $OUT && git commit -m \"Lisää demo-GIF README:hin\" && git push"
