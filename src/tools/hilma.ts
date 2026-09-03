/**
 * Työkalu: hae_julkiset_hankinnat_hilma
 *
 * Lähde: Hilma – julkiset hankinnat (hankintailmoitukset.fi).
 * Käytetään Hilman julkista, avainta vaatimatonta hakurajapintaa, joka palvelee
 * myös sivuston omaa hakua. Taustalla on Azure Cognitive Search -indeksi
 * "eformnotices-v2" (eForms- ja vanhat kansalliset ilmoitukset samassa indeksissä,
 * ml. TED:iin lähetetyt EU-kynnysarvon ylittävät hankinnat).
 *
 *   GET https://www.hankintailmoitukset.fi/search/eformnotices
 *       ?search=<hakusana>&$top=<n>&$count=true
 *       &$orderby=<kenttä>&$filter=<odata>
 *
 * Täydet ilmoitustiedot (koko eForms-XML) saa erikseen AVP-read-rajapinnasta,
 * joka vaatii ilmaisen tilausavaimen – sitä ei tässä työkalussa tarvita.
 */

import { z } from "zod";

import type { ToolDefinition } from "./types.js";

const HILMA_SEARCH_URL =
  "https://www.hankintailmoitukset.fi/search/eformnotices";
const HILMA_NOTICE_BASE =
  "https://www.hankintailmoitukset.fi/fi/public/procurement";
const REQUEST_TIMEOUT_MS = 15_000;

/* -------------------------------------------------------------------------- */
/* Input schema (rekisteröidään index.ts:ssä)                                 */
/* -------------------------------------------------------------------------- */

export const haeJulkisetHankinnatHilmaInputSchema = {
  hakusana: z
    .string()
    .min(1, "Anna hakusana.")
    .describe(
      "Vapaa hakusana, esim. \"it-konsultointi\", \"pilvipalvelut\", \"siivous\", \"rakennusurakka\".",
    ),
  max_tulokset: z
    .number()
    .int()
    .min(1)
    .max(25)
    .default(5)
    .describe("Palautettavien ilmoitusten enimmäismäärä (oletus 5)."),
  vain_aktiiviset: z
    .boolean()
    .default(true)
    .describe(
      "Jos true (oletus), näytetään vain ilmoitukset joiden tarjousten määräaika ei ole umpeutunut.",
    ),
};

/* -------------------------------------------------------------------------- */
/* Hilma-hakuindeksin vastauksen tyypit (löysät)                              */
/* -------------------------------------------------------------------------- */

interface HilmaIlmoitus {
  noticeId?: number;
  procedureId?: number;
  noticeNumber?: string;
  datePublished?: string;
  deadline?: string;
  expirationDate?: string;
  mainType?: string;
  procurementTypeCode?: string;
  titleFi?: string;
  titleSv?: string;
  titleEn?: string;
  titleOther?: string;
  organisationNameFi?: string;
  organisationNameSv?: string;
  organisationNameEn?: string;
  organisationNameOther?: string;
  organisationNationalRegistrationNumber?: string;
  cpvCodes?: string;
  procurementDocumentsUrl?: string;
  isEuProcurement?: boolean;
  isNationalProcurement?: boolean;
}

interface HilmaVastaus {
  "@odata.count"?: number;
  value?: HilmaIlmoitus[];
}

/* -------------------------------------------------------------------------- */
/* Apufunktiot                                                                */
/* -------------------------------------------------------------------------- */

function ekaEiTyhja(...arvot: (string | undefined)[]): string | undefined {
  return arvot.find((v) => typeof v === "string" && v.trim().length > 0)?.trim();
}

function otsikko(n: HilmaIlmoitus): string {
  return (
    ekaEiTyhja(n.titleFi, n.titleEn, n.titleSv, n.titleOther) ?? "(ei otsikkoa)"
  );
}

function hankintayksikko(n: HilmaIlmoitus): string {
  return (
    ekaEiTyhja(
      n.organisationNameFi,
      n.organisationNameEn,
      n.organisationNameSv,
      n.organisationNameOther,
    ) ?? "(hankintayksikkö ei tiedossa)"
  );
}

function maaraaika(n: HilmaIlmoitus): string {
  const raaka = n.deadline ?? n.expirationDate;
  if (!raaka) return "ei määräaikaa / jatkuva haku";
  const pvm = new Date(raaka);
  if (Number.isNaN(pvm.getTime())) return raaka;
  return pvm.toLocaleString("fi-FI", {
    timeZone: "Europe/Helsinki",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ilmoituslinkki(n: HilmaIlmoitus): string {
  if (n.procedureId && n.noticeId) {
    return `${HILMA_NOTICE_BASE}/${n.procedureId}/notice/${n.noticeId}/overview`;
  }
  if (n.noticeId) {
    return `https://www.hankintailmoitukset.fi/fi/public/notice/${n.noticeId}`;
  }
  return "(linkki ei saatavilla)";
}

function isoZulu(d: Date): string {
  return `${d.toISOString().split(".")[0]}Z`;
}

function teksti(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

async function haeJson(url: URL): Promise<HilmaVastaus> {
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
      throw new Error(
        `Hilma-rajapinta palautti HTTP ${res.status} ${res.statusText}`,
      );
    }
    return (await res.json()) as HilmaVastaus;
  } finally {
    clearTimeout(timeout);
  }
}

/* -------------------------------------------------------------------------- */
/* Työkalun toteutus                                                          */
/* -------------------------------------------------------------------------- */

export async function haeJulkisetHankinnatHilma({
  hakusana,
  max_tulokset = 5,
  vain_aktiiviset = true,
}: {
  hakusana: string;
  max_tulokset?: number;
  vain_aktiiviset?: boolean;
}) {
  const haku = hakusana.trim();

  const url = new URL(HILMA_SEARCH_URL);
  url.searchParams.set("search", haku);
  url.searchParams.set("$top", String(max_tulokset));
  url.searchParams.set("$count", "true");

  if (vain_aktiiviset) {
    url.searchParams.set("$filter", `deadline gt ${isoZulu(new Date())}`);
    url.searchParams.set("$orderby", "deadline asc"); // kiireellisin ensin
  } else {
    url.searchParams.set("$orderby", "datePublished desc"); // uusin ensin
  }

  let data: HilmaVastaus;
  try {
    data = await haeJson(url);
  } catch (err) {
    const viesti =
      err instanceof Error && err.name === "AbortError"
        ? `Hilma-haku aikakatkaistiin (${REQUEST_TIMEOUT_MS} ms).`
        : `Hilma-haku epäonnistui: ${(err as Error).message}`;
    return teksti(viesti);
  }

  const ilmoitukset = data.value ?? [];

  if (ilmoitukset.length === 0) {
    return teksti(
      `Ei ${vain_aktiiviset ? "aktiivisia " : ""}hankintailmoituksia haulla "${haku}".\n` +
        "Kokeile yleisempää hakusanaa tai aseta vain_aktiiviset = false nähdäksesi myös päättyneet.",
    );
  }

  const kokonais = data["@odata.count"];
  const lohkot = ilmoitukset.map((n, i) => {
    const rivit = [
      `${i + 1}. ${otsikko(n)}`,
      `   Hankintayksikkö: ${hankintayksikko(n)}`,
      `   Määräaika:       ${maaraaika(n)}`,
      `   Ilmoitus:        ${ilmoituslinkki(n)}`,
    ];
    if (n.procurementDocumentsUrl) {
      rivit.push(`   Tarjouspyyntö:   ${n.procurementDocumentsUrl}`);
    }
    const lisatiedot: string[] = [];
    if (n.noticeNumber) lisatiedot.push(`ilmoitusnro ${n.noticeNumber}`);
    if (n.cpvCodes) lisatiedot.push(`CPV ${n.cpvCodes.split(" ")[0]}`);
    if (n.isEuProcurement) lisatiedot.push("EU-kynnysarvo");
    else if (n.isNationalProcurement) lisatiedot.push("kansallinen");
    if (lisatiedot.length) rivit.push(`   (${lisatiedot.join(", ")})`);
    return rivit.join("\n");
  });

  return teksti(
    `Hakusana "${haku}" — ${ilmoitukset.length} ilmoitusta` +
      (typeof kokonais === "number" ? ` (osumia yhteensä ${kokonais})` : "") +
      (vain_aktiiviset ? ", vain avoinna olevat, kiireellisin ensin" : "") +
      `:\n\n${lohkot.join("\n\n")}`,
  );
}

/* -------------------------------------------------------------------------- */
/* Työkalumäärittely (rekisteri poimii tämän automaattisesti)                 */
/* -------------------------------------------------------------------------- */

export const tool: ToolDefinition<{
  hakusana: string;
  max_tulokset?: number;
  vain_aktiiviset?: boolean;
}> = {
  name: "hae_julkiset_hankinnat_hilma",
  title: "Hae julkiset hankinnat (Hilma)",
  description:
    "Hakee julkisia hankintailmoituksia Hilmasta (hankintailmoitukset.fi) hakusanalla. " +
    "Palauttaa ilmoituksen otsikon, hankintayksikön, tarjousten määräajan ja suorat linkit " +
    "ilmoitukseen ja tarjouspyyntöasiakirjoihin. Oletuksena vain avoinna olevat ilmoitukset.",
  inputSchema: haeJulkisetHankinnatHilmaInputSchema,
  handler: (args) => haeJulkisetHankinnatHilma(args),
};
