/**
 * Työkalu: hae_porssisahko
 *
 * Lähde: porssisahko.net avoin API (keyless)
 *   https://api.porssisahko.net/v1/latest-prices.json
 *
 * Palauttaa Suomen pörssisähkön (spot) tuntihinnat: hinta nyt, seuraavat tunnit,
 * sekä vuorokauden halvin ja kallein tunti. Hinnat sentteinä / kWh, sisältävät
 * arvonlisäveron 25,5 %.
 */

import { z } from "zod";

import type { ToolDefinition } from "./types.js";

const API_URL = "https://api.porssisahko.net/v1/latest-prices.json";
const REQUEST_TIMEOUT_MS = 15_000;
const TZ = "Europe/Helsinki";

/* -------------------------------------------------------------------------- */
/* Input schema                                                               */
/* -------------------------------------------------------------------------- */

export const haePorssisahkoInputSchema = {
  tunnit: z
    .number()
    .int()
    .min(1)
    .max(48)
    .default(12)
    .describe("Kuinka monta tulevaa tuntia listataan (oletus 12, max 48)."),
};

/* -------------------------------------------------------------------------- */
/* Tyypit                                                                     */
/* -------------------------------------------------------------------------- */

interface Hintapiste {
  price?: number;
  startDate?: string; // ISO 8601, UTC
  endDate?: string;
}

interface ApiVastaus {
  prices?: Hintapiste[];
}

interface Tunti {
  alku: Date;
  loppu: Date;
  hinta: number;
}

/* -------------------------------------------------------------------------- */
/* Apufunktiot                                                                */
/* -------------------------------------------------------------------------- */

function teksti(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

/** "07" Helsingin aikaa annetulle hetkelle. */
function helsinkiTunti(d: Date): string {
  return d.toLocaleString("fi-FI", {
    timeZone: TZ,
    hour: "2-digit",
    hour12: false,
  });
}

/** "ke 4.9." Helsingin aikaa. */
function helsinkiPaiva(d: Date): string {
  return d.toLocaleDateString("fi-FI", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "numeric",
  });
}

function tuntileima(t: Tunti): string {
  const alku = helsinkiTunti(t.alku);
  const loppu = helsinkiTunti(t.loppu);
  return `${alku}–${loppu}`;
}

function senttia(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

async function haeJson(): Promise<ApiVastaus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "datakytkin-mcp/0.1 (+https://github.com/datakytkin/suomi-mcp)",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(
        `porssisahko.net palautti HTTP ${res.status} ${res.statusText}`,
      );
    }
    return (await res.json()) as ApiVastaus;
  } finally {
    clearTimeout(timeout);
  }
}

/* -------------------------------------------------------------------------- */
/* Toteutus                                                                   */
/* -------------------------------------------------------------------------- */

export async function haePorssisahko({
  tunnit = 12,
}: {
  tunnit?: number;
}) {
  let data: ApiVastaus;
  try {
    data = await haeJson();
  } catch (err) {
    const viesti =
      err instanceof Error && err.name === "AbortError"
        ? `Pörssisähköhaku aikakatkaistiin (${REQUEST_TIMEOUT_MS} ms).`
        : `Pörssisähköhaku epäonnistui: ${(err as Error).message}`;
    return teksti(viesti);
  }

  const kaikki: Tunti[] = (data.prices ?? [])
    .filter(
      (p): p is Required<Hintapiste> =>
        typeof p.price === "number" &&
        typeof p.startDate === "string" &&
        typeof p.endDate === "string",
    )
    .map((p) => ({
      alku: new Date(p.startDate),
      loppu: new Date(p.endDate),
      hinta: p.price,
    }))
    .filter((t) => !Number.isNaN(t.alku.getTime()))
    .sort((a, b) => a.alku.getTime() - b.alku.getTime());

  if (kaikki.length === 0) {
    return teksti("Pörssisähkön hintatietoja ei ole juuri nyt saatavilla.");
  }

  const nyt = new Date();
  const nykyinen = kaikki.find((t) => t.alku <= nyt && nyt < t.loppu);
  const tulevat = kaikki.filter((t) => t.loppu > nyt).slice(0, tunnit);

  // Halvin / kallein koko haetusta aineistosta (yleensä tänään + huominen).
  const halvin = kaikki.reduce((a, b) => (b.hinta < a.hinta ? b : a));
  const kallein = kaikki.reduce((a, b) => (b.hinta > a.hinta ? b : a));

  const rivit: string[] = [
    "Pörssisähkö (spot, sis. ALV 25,5 %) — lähde: porssisahko.net",
    "",
  ];

  if (nykyinen) {
    rivit.push(
      `Hinta nyt (${helsinkiPaiva(nykyinen.alku)} klo ${tuntileima(nykyinen)}): ${senttia(nykyinen.hinta)} c/kWh`,
    );
  } else {
    rivit.push("Hinta nyt: ei saatavilla (aineisto alkaa tulevaisuudesta).");
  }

  rivit.push("", `Seuraavat ${tulevat.length} tuntia:`);
  let edellinenPaiva = "";
  for (const t of tulevat) {
    const pv = helsinkiPaiva(t.alku);
    const pvEtuliite = pv !== edellinenPaiva ? `${pv} ` : "        ";
    edellinenPaiva = pv;
    const merkinta =
      t.alku.getTime() === halvin.alku.getTime()
        ? "  ← halvin"
        : t.alku.getTime() === kallein.alku.getTime()
          ? "  ← kallein"
          : "";
    rivit.push(
      `  ${pvEtuliite}${tuntileima(t)}  ${senttia(t.hinta).padStart(6)} c/kWh${merkinta}`,
    );
  }

  rivit.push(
    "",
    `Halvin:  ${helsinkiPaiva(halvin.alku)} klo ${tuntileima(halvin)}  ${senttia(halvin.hinta)} c/kWh`,
    `Kallein: ${helsinkiPaiva(kallein.alku)} klo ${tuntileima(kallein)}  ${senttia(kallein.hinta)} c/kWh`,
  );

  return teksti(rivit.join("\n"));
}

/* -------------------------------------------------------------------------- */
/* Työkalumäärittely (rekisteri poimii tämän automaattisesti)                 */
/* -------------------------------------------------------------------------- */

export const tool: ToolDefinition<{ tunnit?: number }> = {
  name: "hae_porssisahko",
  title: "Hae pörssisähkön hinta",
  description:
    "Hakee Suomen pörssisähkön (spot) tuntihinnat: hinta nyt, seuraavat tunnit " +
    "sekä vuorokauden halvin ja kallein tunti. Hinnat c/kWh, sisältävät ALV 25,5 %. " +
    "Lähde: porssisahko.net (avoin, ei API-avainta).",
  inputSchema: haePorssisahkoInputSchema,
  handler: (args) => haePorssisahko(args),
};
