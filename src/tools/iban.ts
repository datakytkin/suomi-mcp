/**
 * Työkalu: tarkista_iban
 *
 * Ei ulkoista rajapintaa – pelkkä ISO 13616 -tarkistus (mod-97) ja
 * maakohtainen pituus. Suomalaiselle IBANille lisäksi kansallinen tilinumero
 * (BBAN) ja arvio pankista konekielisen tunnuksen alkunumeroista.
 */

import { z } from "zod";

import type { ToolDefinition } from "./types.js";

export const tarkistaIbanInputSchema = {
  iban: z
    .string()
    .min(5)
    .describe("IBAN-tilinumero, esim. \"FI21 1234 5600 0007 85\" (välit sallittu)."),
};

/** IBANin pituus maakoodeittain (yleisimmät; muut validoidaan silti mod-97:lla). */
const IBAN_PITUUS: Record<string, number> = {
  FI: 18, SE: 24, NO: 15, DK: 18, DE: 22, EE: 20, LV: 21, LT: 20, NL: 18,
  BE: 16, FR: 27, ES: 24, IT: 27, IE: 22, PL: 28, AT: 20, PT: 25, GB: 22,
  CH: 21, LU: 20, IS: 26,
};

/** Suomalaisen konekielisen tunnuksen alkunumerot -> pankki (arvio). */
function suomalainenPankki(bban: string): string | undefined {
  const d = bban.replace(/\D/g, "");
  const p2 = d.slice(0, 2);
  const p1 = d.slice(0, 1);
  if (p1 === "1" || p1 === "2") return "Nordea";
  if (p2 === "31" || p2 === "33" || p2 === "34") return "Handelsbanken";
  if (p2 === "36") return "Tapiola / S-Pankki";
  if (p2 === "37") return "DNB";
  if (p2 === "38") return "Swedbank";
  if (p2 === "39") return "S-Pankki";
  if (p1 === "4") return "Aktia / Säästöpankki / POP Pankki / Oma Säästöpankki";
  if (p1 === "5") return "OP (Osuuspankki)";
  if (p2 === "66") return "Ålandsbanken";
  if (p1 === "8") return "Danske Bank";
  return undefined;
}

function teksti(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

/** mod-97 (ISO 7064): siirrä 4 ensimmäistä merkkiä loppuun, kirjaimet -> numerot. */
function mod97(iban: string): number {
  const rearr = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearr.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let jaannos = 0;
  for (const ch of numeric) {
    jaannos = (jaannos * 10 + (ch.charCodeAt(0) - 48)) % 97;
  }
  return jaannos;
}

export function tarkistaIban({ iban }: { iban: string }) {
  const s = iban.toUpperCase().replace(/\s+/g, "");

  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(s)) {
    return teksti(
      `"${iban}" ei ole IBAN-muotoa (2 kirjainta + 2 tarkistusnumeroa + tilinumero).`,
    );
  }

  const maa = s.slice(0, 2);
  const odotettuPituus = IBAN_PITUUS[maa];
  if (odotettuPituus && s.length !== odotettuPituus) {
    return teksti(
      `IBAN ${maa}: väärä pituus (${s.length}, pitäisi olla ${odotettuPituus}). Tarkistus EI läpäissyt.`,
    );
  }

  const kelpo = mod97(s) === 1;
  if (!kelpo) {
    return teksti(
      `IBAN ${muotoile(s)}: TARKISTUS EI LÄPÄISSYT (mod-97). Numeroissa on virhe tai kirjoitusvirhe.`,
    );
  }

  const rivit = [`IBAN ${muotoile(s)}: kelvollinen (mod-97 OK).`, `Maa: ${maa}`];

  if (maa === "FI") {
    const bban = s.slice(4); // 14 numeroa
    const konekielinen = `${bban.slice(0, 6)}-${bban.slice(6).replace(/^0+/, "") || "0"}`;
    rivit.push(`Kansallinen tilinumero: ${konekielinen}`);
    const pankki = suomalainenPankki(bban);
    if (pankki) rivit.push(`Pankki (arvio): ${pankki}`);
  }

  return teksti(rivit.join("\n"));
}

/** Ryhmittele 4 merkin lohkoihin luettavuuden vuoksi. */
function muotoile(s: string): string {
  return s.replace(/(.{4})/g, "$1 ").trim();
}

export const tool: ToolDefinition<{ iban: string }> = {
  name: "tarkista_iban",
  title: "Tarkista IBAN-tilinumero",
  description:
    "Tarkistaa IBAN-tilinumeron rakenteen ja tarkistusnumeron (mod-97). " +
    "Suomalaiselle IBANille näyttää myös kansallisen tilinumeron ja arvion " +
    "pankista. Ei tee verkkokutsuja.",
  inputSchema: tarkistaIbanInputSchema,
  handler: (args) => tarkistaIban(args),
};
