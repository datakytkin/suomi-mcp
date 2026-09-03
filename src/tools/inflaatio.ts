/**
 * Työkalu: laske_inflaatio
 *
 * Lähde: Tilastokeskus StatFin PxWeb API (keyless)
 *   taulu khi/11xm.px – Elinkustannusindeksi (1951:10=100), vuositiedot 1951–
 *
 * Laskee rahan ostovoiman muutoksen vuosien välillä elinkustannusindeksillä
 * (yhtenäinen sarja vuodesta 1951). "1000 € vuonna 1985 vastaa X € vuonna 2025."
 */

import { z } from "zod";

import type { ToolDefinition } from "./types.js";

const PXWEB_URL =
  "https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin/khi/11xm.px";
const REQUEST_TIMEOUT_MS = 15_000;
const ENSIMMAINEN_VUOSI = 1951;

export const laskeInflaatioInputSchema = {
  summa: z
    .number()
    .positive()
    .describe("Rahasumma euroina, jonka ostovoima muunnetaan."),
  vuosi_alku: z
    .number()
    .int()
    .min(ENSIMMAINEN_VUOSI)
    .describe("Lähtövuosi (summan vuosi), 1951 tai myöhemmin."),
  vuosi_loppu: z
    .number()
    .int()
    .min(ENSIMMAINEN_VUOSI)
    .optional()
    .describe("Kohdevuosi. Oletus: viimeisin saatavilla oleva vuosi."),
};

/* json-stat2 -vastauksen olennaiset osat. */
interface JsonStat2 {
  value?: (number | null)[];
  dimension?: {
    timeperiod_y?: {
      category?: { index?: Record<string, number> };
    };
  };
}

let sarjaCache: Map<number, number> | null = null;

/** Vain testejä varten. */
export function _resetSarjaCache(): void {
  sarjaCache = null;
}

function teksti(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

/** Hae koko KHI 2015=100 -sarja { vuosi -> pisteluku }, cache prosessin ajaksi. */
async function haeSarja(): Promise<Map<number, number>> {
  if (sarjaCache) return sarjaCache;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(PXWEB_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent":
          "datakytkin-mcp/0.1 (+https://github.com/datakytkin/suomi-mcp)",
      },
      signal: controller.signal,
      body: JSON.stringify({
        query: [],
        response: { format: "json-stat2" },
      }),
    });
    if (!res.ok) {
      throw new Error(
        `Tilastokeskus palautti HTTP ${res.status} ${res.statusText}`,
      );
    }
    const data = (await res.json()) as JsonStat2;
    const index = data.dimension?.timeperiod_y?.category?.index ?? {};
    const values = data.value ?? [];

    const map = new Map<number, number>();
    for (const [vuosi, pos] of Object.entries(index)) {
      const luku = values[pos];
      if (typeof luku === "number") map.set(Number(vuosi), luku);
    }
    if (map.size === 0) throw new Error("indeksisarja oli tyhjä");
    sarjaCache = map;
    return map;
  } finally {
    clearTimeout(timeout);
  }
}

function euro(n: number): string {
  return n
    .toLocaleString("fi-FI", { maximumFractionDigits: 2 })
    .replace(/ /g, " ");
}

export async function laskeInflaatio({
  summa,
  vuosi_alku,
  vuosi_loppu,
}: {
  summa: number;
  vuosi_alku: number;
  vuosi_loppu?: number;
}) {
  let sarja: Map<number, number>;
  try {
    sarja = await haeSarja();
  } catch (err) {
    const viesti =
      err instanceof Error && err.name === "AbortError"
        ? `Tilastokeskus-haku aikakatkaistiin (${REQUEST_TIMEOUT_MS} ms).`
        : `Kuluttajahintaindeksin haku epäonnistui: ${(err as Error).message}`;
    return teksti(viesti);
  }

  const vuodet = [...sarja.keys()].sort((a, b) => a - b);
  const uusin = vuodet[vuodet.length - 1]!;
  const vanhin = vuodet[0]!;
  const loppu = vuosi_loppu ?? uusin;

  const idxAlku = sarja.get(vuosi_alku);
  const idxLoppu = sarja.get(loppu);

  if (idxAlku === undefined || idxLoppu === undefined) {
    const puuttuu = idxAlku === undefined ? vuosi_alku : loppu;
    return teksti(
      `Vuodelle ${puuttuu} ei ole elinkustannusindeksiä. Saatavilla ${vanhin}–${uusin}.`,
    );
  }

  const muunnettu = (summa * idxLoppu) / idxAlku;
  const muutosProsentti = (idxLoppu / idxAlku - 1) * 100;
  const suunta = muutosProsentti >= 0 ? "nousseet" : "laskeneet";

  return teksti(
    [
      `${euro(summa)} € vuonna ${vuosi_alku} vastaa ostovoimaltaan ` +
        `${euro(muunnettu)} € vuonna ${loppu}.`,
      "",
      `Hinnat ovat ${suunta} ${Math.abs(muutosProsentti).toFixed(1).replace(".", ",")} % ` +
        `tällä välillä (elinkustannusindeksi ${vuosi_alku}: ${Math.round(idxAlku)}, ` +
        `${loppu}: ${Math.round(idxLoppu)}; 1951:10=100).`,
      `Lähde: Tilastokeskus, elinkustannusindeksi.`,
    ].join("\n"),
  );
}

export const tool: ToolDefinition<{
  summa: number;
  vuosi_alku: number;
  vuosi_loppu?: number;
}> = {
  name: "laske_inflaatio",
  title: "Laske inflaatio / rahan ostovoima",
  description:
    "Muuntaa rahasumman ostovoiman vuosien välillä Tilastokeskuksen " +
    "elinkustannusindeksillä (yhtenäinen sarja vuodesta 1951). Esim. \"paljonko " +
    "1000 € vuonna 1985 on nyt\". Anna summa (€) ja lähtövuosi; kohdevuosi " +
    "oletuksena viimeisin.",
  inputSchema: laskeInflaatioInputSchema,
  handler: (args) => laskeInflaatio(args),
};
