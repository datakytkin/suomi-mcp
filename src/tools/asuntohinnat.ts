/**
 * Työkalu: hae_asuntojen_hinnat
 *
 * Lähde: Tilastokeskus StatFin PxWeb API (keyless)
 *   taulu ashi/13mu.px – Vanhojen osakeasuntojen neliöhinnat ja kauppojen
 *   lukumäärät postinumeroalueittain, vuosittain (2009–)
 *
 * Palauttaa neliöhinnat talotyypeittäin ja kauppojen määrän annetulla
 * postinumeroalueella.
 */

import { z } from "zod";

import type { ToolDefinition } from "./types.js";

const PXWEB_URL =
  "https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin/ashi/13mu.px";
const REQUEST_TIMEOUT_MS = 15_000;

export const haeAsuntojenHinnatInputSchema = {
  postinumero: z
    .string()
    .regex(/^\d{5}$/, "Anna 5-numeroinen postinumero, esim. 00100.")
    .describe("5-numeroinen postinumero, esim. 00100."),
  vuosi: z
    .number()
    .int()
    .min(2009)
    .optional()
    .describe("Tilastovuosi. Oletus: viimeisin saatavilla."),
};

interface JsonStat2 {
  label?: string;
  id?: string[];
  size?: number[];
  value?: (number | null)[];
  dimension?: Record<
    string,
    { category?: { index?: Record<string, number>; label?: Record<string, string> } }
  >;
}

function teksti(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function eur(n: number): string {
  return n.toLocaleString("fi-FI").replace(/[  ]/g, " ");
}

async function haeJson(body: unknown): Promise<JsonStat2 | null> {
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
      body: JSON.stringify(body),
    });
    if (res.status === 400) return null; // tuntematon postinumero tms.
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

export async function haeAsuntojenHinnat({
  postinumero,
  vuosi,
}: {
  postinumero: string;
  vuosi?: number;
}) {
  const vuosiValinta = vuosi
    ? { filter: "item", values: [String(vuosi)] }
    : { filter: "top", values: ["1"] };

  let data: JsonStat2 | null;
  try {
    data = await haeJson({
      query: [
        {
          code: "postinumeroalue_4_20220101",
          selection: { filter: "item", values: [postinumero] },
        },
        { code: "timeperiod_y", selection: vuosiValinta },
      ],
      response: { format: "json-stat2" },
    });
  } catch (err) {
    const viesti =
      err instanceof Error && err.name === "AbortError"
        ? `Tilastokeskus-haku aikakatkaistiin (${REQUEST_TIMEOUT_MS} ms).`
        : `Asuntohintojen haku epäonnistui: ${(err as Error).message}`;
    return teksti(viesti);
  }

  if (!data || !data.value?.some((v) => v !== null)) {
    return teksti(
      `Ei julkaistuja asuntohintoja postinumerolle ${postinumero}` +
        (vuosi ? ` vuodelta ${vuosi}` : "") +
        ". Pienten alueiden tietoja ei julkaista tietosuojan vuoksi.",
    );
  }

  // json-stat2 value-taulukko on row-major dims-järjestyksessä:
  // [timeperiod_y=1, postinumero=1, talotyyppi=N, contentscode=2]
  const dims = data.id ?? [];
  const talotyyppiDim = data.dimension?.["talotyyppi_6_20131021"]?.category;
  const talotyypit = Object.keys(talotyyppiDim?.index ?? {}).sort(
    (a, b) => (talotyyppiDim!.index![a]! - talotyyppiDim!.index![b]!),
  );
  const talotyyppiNimet = talotyypit.map(
    (k) => talotyyppiDim?.label?.[k] ?? k,
  );

  const vuosiKey = Object.keys(
    data.dimension?.["timeperiod_y"]?.category?.index ?? {},
  )[0];
  const alueLabel =
    Object.values(
      data.dimension?.["postinumeroalue_4_20220101"]?.category?.label ?? {},
    )[0] ?? postinumero;

  const vals = data.value ?? [];
  const rivit = [
    `Vanhojen osakeasuntojen neliöhinnat – ${alueLabel}`,
    `Vuosi: ${vuosiKey ?? "?"}  (lähde: Tilastokeskus, ashi)`,
    "",
    "  Talotyyppi              €/m²      kauppoja",
  ];
  // contentscode-järjestys: 0 = neliöhinta, 1 = kauppojen lkm
  const nContent = data.size?.[dims.indexOf("contentscode")] ?? 2;
  talotyypit.forEach((_, i) => {
    const hinta = vals[i * nContent];
    const lkm = vals[i * nContent + 1];
    if (hinta == null && lkm == null) return;
    rivit.push(
      `  ${(talotyyppiNimet[i] ?? "").padEnd(22)}` +
        `${hinta != null ? `${eur(hinta)} €`.padStart(9) : "     –   "}` +
        `  ${lkm != null ? String(lkm).padStart(6) : "     –"}`,
    );
  });

  return teksti(rivit.join("\n"));
}

export const tool: ToolDefinition<{ postinumero: string; vuosi?: number }> = {
  name: "hae_asuntojen_hinnat",
  title: "Hae asuntojen neliöhinnat (postinumero)",
  description:
    "Hakee vanhojen osakeasuntojen neliöhinnat ja kauppojen lukumäärän " +
    "postinumeroalueella Tilastokeskuksen tilastosta, talotyypeittäin " +
    "(yksiöt / kaksiot / kolmiot+ / rivitalot). Anna postinumero ja halutessasi vuosi.",
  inputSchema: haeAsuntojenHinnatInputSchema,
  handler: (args) => haeAsuntojenHinnat(args),
};
