/**
 * Työkalu: hae_saa
 *
 * Lähde: Ilmatieteen laitos, avoin data (WFS, keyless)
 *   https://opendata.fmi.fi/wfs  – stored query
 *   fmi::forecast::edited::weather::scandinavia::point::simple
 *
 * Palauttaa sääennusteen (lämpötila, tuuli, sade, kosteus) tunneittain
 * annetulle paikkakunnalle Helsingin aikaa.
 */

import { z } from "zod";

import type { ToolDefinition } from "./types.js";

const WFS_URL = "https://opendata.fmi.fi/wfs";
const STORED_QUERY = "fmi::forecast::edited::weather::scandinavia::point::simple";
const PARAMS = "Temperature,WindSpeedMS,PrecipitationAmount,Humidity";
const REQUEST_TIMEOUT_MS = 20_000;
const TZ = "Europe/Helsinki";

export const haeSaaInputSchema = {
  paikkakunta: z
    .string()
    .min(2)
    .describe("Paikkakunta Suomessa, esim. \"Helsinki\", \"Rovaniemi\", \"Tampere\"."),
  tunnit: z
    .number()
    .int()
    .min(1)
    .max(48)
    .default(12)
    .describe("Kuinka monta tulevaa tuntia näytetään (oletus 12, max 48)."),
};

interface Havainto {
  aika: Date;
  lampo?: number;
  tuuli?: number;
  sade?: number;
  kosteus?: number;
}

function teksti(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function hkiTunti(d: Date): string {
  return d.toLocaleString("fi-FI", { timeZone: TZ, hour: "2-digit", hour12: false });
}
function hkiPaiva(d: Date): string {
  return d.toLocaleDateString("fi-FI", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "numeric",
  });
}
function num(n: number | undefined, yksikko: string, desimaalit = 1): string {
  if (n === undefined || Number.isNaN(n)) return "–";
  return `${n.toFixed(desimaalit).replace(".", ",")}${yksikko}`;
}

/** Jäsentää BsWfs "simple" -XML:n havainnoiksi aikaleiman mukaan. */
function jäsennä(xml: string): Havainto[] {
  const byTime = new Map<string, Havainto>();
  const members = xml.split("<wfs:member>");
  for (const m of members) {
    const aika = m.match(/<BsWfs:Time>([^<]+)<\/BsWfs:Time>/)?.[1];
    const nimi = m.match(/<BsWfs:ParameterName>([^<]+)<\/BsWfs:ParameterName>/)?.[1];
    const arvo = m.match(/<BsWfs:ParameterValue>([^<]+)<\/BsWfs:ParameterValue>/)?.[1];
    if (!aika || !nimi || arvo === undefined) continue;

    let h = byTime.get(aika);
    if (!h) {
      h = { aika: new Date(aika) };
      byTime.set(aika, h);
    }
    const v = Number(arvo);
    if (Number.isNaN(v)) continue;
    if (nimi === "Temperature") h.lampo = v;
    else if (nimi === "WindSpeedMS") h.tuuli = v;
    else if (nimi === "PrecipitationAmount") h.sade = v;
    else if (nimi === "Humidity") h.kosteus = v;
  }
  return [...byTime.values()]
    .filter((h) => !Number.isNaN(h.aika.getTime()))
    .sort((a, b) => a.aika.getTime() - b.aika.getTime());
}

async function haeXml(paikkakunta: string): Promise<string> {
  const url = new URL(WFS_URL);
  url.searchParams.set("service", "WFS");
  url.searchParams.set("version", "2.0.0");
  url.searchParams.set("request", "getFeature");
  url.searchParams.set("storedquery_id", STORED_QUERY);
  url.searchParams.set("place", paikkakunta);
  url.searchParams.set("parameters", PARAMS);
  url.searchParams.set("timestep", "60");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "datakytkin-mcp/0.1 (+https://github.com/datakytkin/suomi-mcp)",
      },
      signal: controller.signal,
    });
    const body = await res.text();
    if (!res.ok && !body.includes("ExceptionReport")) {
      throw new Error(`FMI palautti HTTP ${res.status} ${res.statusText}`);
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

export async function haeSaa({
  paikkakunta,
  tunnit = 12,
}: {
  paikkakunta: string;
  tunnit?: number;
}) {
  let xml: string;
  try {
    xml = await haeXml(paikkakunta.trim());
  } catch (err) {
    const viesti =
      err instanceof Error && err.name === "AbortError"
        ? `Sääennuste-haku aikakatkaistiin (${REQUEST_TIMEOUT_MS} ms).`
        : `Sääennuste-haku epäonnistui: ${(err as Error).message}`;
    return teksti(viesti);
  }

  if (xml.includes("ExceptionReport")) {
    const syy = xml.match(/<ExceptionText>([^<]+)<\/ExceptionText>/)?.[1]?.trim();
    return teksti(
      `Paikkakuntaa "${paikkakunta}" ei tunnistettu.` +
        (syy ? `\n(FMI: ${syy})` : "") +
        "\nKokeile suomenkielistä nimeä ilman taivutusta, esim. \"Jyväskylä\".",
    );
  }

  const kaikki = jäsennä(xml);
  if (kaikki.length === 0) {
    return teksti(`Sääennustetta ei saatu paikkakunnalle "${paikkakunta}".`);
  }

  const now = Date.now();
  const tulevat = kaikki.filter((h) => h.aika.getTime() >= now - 3_600_000).slice(0, tunnit);
  const lämmöt = tulevat.map((h) => h.lampo).filter((n): n is number => n !== undefined);
  const min = lämmöt.length ? Math.min(...lämmöt) : undefined;
  const max = lämmöt.length ? Math.max(...lämmöt) : undefined;
  const sadeYht = tulevat.reduce((s, h) => s + (h.sade ?? 0), 0);

  const rivit = [
    `Sääennuste – ${paikkakunta} (lähde: Ilmatieteen laitos)`,
    `Seuraavat ${tulevat.length} h: lämpötila ${num(min, "")}…${num(max, " °C")}, sadetta yhteensä ${num(sadeYht, " mm")}`,
    "",
    "  aika          lämpö    tuuli     sade   kosteus",
  ];
  let edPv = "";
  for (const h of tulevat) {
    const pv = hkiPaiva(h.aika);
    const pref = pv !== edPv ? pv.padEnd(9) : "         ";
    edPv = pv;
    rivit.push(
      `  ${pref}${hkiTunti(h.aika)}  ` +
        `${num(h.lampo, " °C").padStart(7)}  ` +
        `${num(h.tuuli, " m/s").padStart(7)}  ` +
        `${num(h.sade, " mm").padStart(7)}  ` +
        `${num(h.kosteus, " %", 0).padStart(6)}`,
    );
  }
  return teksti(rivit.join("\n"));
}

export const tool: ToolDefinition<{ paikkakunta: string; tunnit?: number }> = {
  name: "hae_saa",
  title: "Hae sääennuste (Ilmatieteen laitos)",
  description:
    "Hakee sääennusteen (lämpötila, tuuli, sade, ilmankosteus) tunneittain " +
    "suomalaiselle paikkakunnalle Ilmatieteen laitoksen avoimesta datasta. " +
    "Anna paikkakunnan nimi ja halutessasi tuntimäärä.",
  inputSchema: haeSaaInputSchema,
  handler: (args) => haeSaa(args),
};
