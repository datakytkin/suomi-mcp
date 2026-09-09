/**
 * Työkalu: hae_polttoaineen_hinnat
 *
 * Lähde: Tilastokeskus StatFin PxWeb API (keyless)
 *   taulu khi/11xx.px – Polttonesteiden keskihintoja, kuukausitiedot
 *
 * Palauttaa bensiinin, dieselin ja kevyen polttoöljyn keskihinnan viimeisimmältä
 * tilastokuukaudelta sekä muutoksen edelliseen kuukauteen ja vuoden takaiseen.
 *
 * Huom: kuukauden keskihinta, päivittyy noin kuukauden viiveellä. Ei siis
 * reaaliaikainen pörssi- tai pumppuhinta.
 */

import { z } from "zod";

import type { ToolDefinition } from "./types.js";

const PXWEB_URL =
  "https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin/khi/11xx.px";
const REQUEST_TIMEOUT_MS = 15_000;

export const haePolttoaineenHinnatInputSchema = {};

interface JsonStat2 {
  value?: (number | null)[];
  dimension?: {
    timeperiod_m?: { category?: { index?: Record<string, number> } };
    coicop_13_20160512?: {
      category?: { index?: Record<string, number>; label?: Record<string, string> };
    };
  };
}

function teksti(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function hinta(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

function muutos(nyt: number | null | undefined, ref: number | null | undefined): string {
  if (nyt == null || ref == null || ref === 0) return "–";
  const p = ((nyt - ref) / ref) * 100;
  const merkki = p >= 0 ? "+" : "−";
  return `${merkki}${Math.abs(p).toFixed(1).replace(".", ",")} %`;
}

function kkNimi(key: string): string {
  const m = key.match(/^(\d{4})M(\d{2})$/);
  return m ? `${m[2]}/${m[1]}` : key;
}

async function haeJson(): Promise<JsonStat2> {
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
        query: [
          {
            code: "timeperiod_m",
            selection: { filter: "top", values: ["13"] },
          },
        ],
        response: { format: "json-stat2" },
      }),
    });
    if (!res.ok) {
      throw new Error(
        `Tilastokeskus palautti HTTP ${res.status} ${res.statusText}`,
      );
    }
    return (await res.json()) as JsonStat2;
  } finally {
    clearTimeout(timeout);
  }
}

/** Näytettävät polttoaineet (label sisältää nämä osajonoina). */
const NAYTA = ["Bensiini 95", "Bensiini 98", "Diesel", "Kevyt polttoöljy"];

export async function haePolttoaineenHinnat() {
  let data: JsonStat2;
  try {
    data = await haeJson();
  } catch (err) {
    const viesti =
      err instanceof Error && err.name === "AbortError"
        ? `Tilastokeskus-haku aikakatkaistiin (${REQUEST_TIMEOUT_MS} ms).`
        : `Polttoainehintojen haku epäonnistui: ${(err as Error).message}`;
    return teksti(viesti);
  }

  const kuukaudet = Object.keys(
    data.dimension?.timeperiod_m?.category?.index ?? {},
  );
  const fuelIndex = data.dimension?.coicop_13_20160512?.category?.index ?? {};
  const fuelLabel = data.dimension?.coicop_13_20160512?.category?.label ?? {};
  const fuelKeys = Object.keys(fuelIndex).sort(
    (a, b) => fuelIndex[a]! - fuelIndex[b]!,
  );
  const vals = data.value ?? [];
  const nFuel = fuelKeys.length;

  if (kuukaudet.length === 0 || nFuel === 0 || vals.length === 0) {
    return teksti("Polttoainehintoja ei ole juuri nyt saatavilla.");
  }

  const viim = kuukaudet.length - 1;
  const edKk = viim - 1;
  const v12 = 0; // top 13 -> ensimmäinen on 12 kk sitten

  const rivit = [
    `Polttonesteiden keskihinnat – ${kkNimi(kuukaudet[viim]!)} (Tilastokeskus)`,
    "",
    "  Polttoaine            hinta      vs. ed. kk    vs. 12 kk",
  ];
  fuelKeys.forEach((fk, fi) => {
    const label = fuelLabel[fk] ?? fk;
    if (!NAYTA.some((n) => label.includes(n))) return;
    const nyt = vals[viim * nFuel + fi];
    const ed = vals[edKk * nFuel + fi];
    const vanha = vals[v12 * nFuel + fi];
    if (nyt == null) return;
    const nimi = label.replace(/,\s*1\s*l$/i, "");
    rivit.push(
      `  ${nimi.padEnd(20)}${hinta(nyt).padStart(9)}` +
        `   ${muutos(nyt, ed).padStart(9)}` +
        `   ${muutos(nyt, vanha).padStart(9)}`,
    );
  });
  rivit.push("", "Kuukauden keskihinta, ei reaaliaikainen pumppuhinta.");

  return teksti(rivit.join("\n"));
}

export const tool: ToolDefinition<Record<string, never>> = {
  name: "hae_polttoaineen_hinnat",
  title: "Hae polttoaineen hinnat",
  description:
    "Hakee bensiinin (95 E10, 98 E5), dieselin ja kevyen polttoöljyn " +
    "keskihinnan viimeisimmältä tilastokuukaudelta sekä muutoksen edelliseen " +
    "kuukauteen ja vuoden takaiseen. Lähde: Tilastokeskus (kuukauden keskihinta).",
  inputSchema: haePolttoaineenHinnatInputSchema,
  handler: () => haePolttoaineenHinnat(),
};
