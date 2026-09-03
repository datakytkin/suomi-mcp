/**
 * Työkalu: tarkista_alv_tunnus
 *
 * Lähde: EU VIES REST API (keyless)
 *   https://ec.europa.eu/taxation_customs/vies/rest-api/ms/{maa}/vat/{numero}
 *
 * Tarkistaa EU:n ALV-tunnuksen (VAT number) voimassaolon ja palauttaa
 * rekisteröidyn nimen ja osoitteen. Pakollinen tarkistus ennen ALV 0 % -laskutusta
 * toiseen EU-maahan.
 */

import { z } from "zod";

import type { ToolDefinition } from "./types.js";

const VIES_BASE = "https://ec.europa.eu/taxation_customs/vies/rest-api/ms";
const REQUEST_TIMEOUT_MS = 15_000;

const EU_MAAT = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "EL", "ES", "FI", "FR", "HR",
  "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI",
  "SK", "XI", // XI = Pohjois-Irlanti
]);

export const tarkistaAlvTunnusInputSchema = {
  alv_tunnus: z
    .string()
    .min(3)
    .describe(
      "EU:n ALV-tunnus maakoodilla, esim. \"FI01098628\", \"DE811128135\". " +
        "Suomalaisen Y-tunnuksen (1234567-8) voi antaa myös sellaisenaan.",
    ),
};

interface ViesVastaus {
  isValid?: boolean;
  requestDate?: string;
  userError?: string;
  name?: string;
  address?: string;
  vatNumber?: string;
}

function teksti(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

/** Normalisoi syöte muotoon { maa: "FI", numero: "01098628" }. */
function jäsennä(raaka: string): { maa: string; numero: string } | null {
  const s = raaka.toUpperCase().replace(/[\s.\-]/g, "");

  // Pelkkä suomalainen Y-tunnus (7-8 numeroa, ei maakoodia) -> FI
  if (/^\d{7,8}$/.test(s)) {
    return { maa: "FI", numero: s.padStart(8, "0") };
  }

  const m = s.match(/^([A-Z]{2})(.+)$/);
  if (!m) return null;
  const maa = m[1] === "GR" ? "EL" : m[1]!; // Kreikka: VIES käyttää EL
  return { maa, numero: m[2]! };
}

async function haeJson(url: string): Promise<ViesVastaus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "datakytkin-mcp/0.1 (+https://github.com/datakytkin/suomi-mcp)",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`VIES palautti HTTP ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as ViesVastaus;
  } finally {
    clearTimeout(timeout);
  }
}

export async function tarkistaAlvTunnus({
  alv_tunnus,
}: {
  alv_tunnus: string;
}) {
  const osat = jäsennä(alv_tunnus);
  if (!osat) {
    return teksti(
      `En tunnistanut ALV-tunnusta "${alv_tunnus}". Anna se maakoodilla, esim. FI01098628.`,
    );
  }
  if (!EU_MAAT.has(osat.maa)) {
    return teksti(
      `Maakoodi "${osat.maa}" ei ole EU:n ALV-alueella. VIES tarkistaa vain EU-maiden (+ XI) tunnuksia.`,
    );
  }

  let data: ViesVastaus;
  try {
    data = await haeJson(
      `${VIES_BASE}/${osat.maa}/vat/${encodeURIComponent(osat.numero)}`,
    );
  } catch (err) {
    const viesti =
      err instanceof Error && err.name === "AbortError"
        ? `VIES-tarkistus aikakatkaistiin (${REQUEST_TIMEOUT_MS} ms).`
        : `VIES-tarkistus epäonnistui: ${(err as Error).message}. ` +
          "VIES-palvelu on ajoittain alhaalla – yritä myöhemmin uudelleen.";
    return teksti(viesti);
  }

  const tunnus = `${osat.maa}${data.vatNumber ?? osat.numero}`;

  if (data.isValid) {
    const rivit = [
      `ALV-tunnus ${tunnus}: VOIMASSA`,
      `Nimi:    ${data.name?.trim() || "(ei palautettu)"}`,
      `Osoite:  ${(data.address ?? "").replace(/\n/g, ", ").trim() || "(ei palautettu)"}`,
    ];
    if (data.requestDate) rivit.push(`Tarkistettu: ${data.requestDate}`);
    return teksti(rivit.join("\n"));
  }

  if (data.userError && data.userError !== "VALID") {
    return teksti(
      `ALV-tunnus ${tunnus}: EI VOIMASSA (VIES: ${data.userError}).\n` +
        "Tarkista numero ja maakoodi. \"INVALID\" tarkoittaa ettei tunnusta löydy rekisteristä.",
    );
  }

  return teksti(`ALV-tunnus ${tunnus}: EI VOIMASSA.`);
}

export const tool: ToolDefinition<{ alv_tunnus: string }> = {
  name: "tarkista_alv_tunnus",
  title: "Tarkista EU-ALV-tunnus (VIES)",
  description:
    "Tarkistaa EU:n ALV-tunnuksen (VAT number) voimassaolon EU:n VIES-palvelusta " +
    "ja palauttaa rekisteröidyn nimen ja osoitteen. Anna tunnus maakoodilla " +
    "(esim. FI01098628, DE811128135). Käytä ennen ALV 0 % -laskutusta EU-maahan.",
  inputSchema: tarkistaAlvTunnusInputSchema,
  handler: (args) => tarkistaAlvTunnus(args),
};
