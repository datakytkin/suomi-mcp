/**
 * Työkalu: hae_hankintailmoitus
 *
 * Lähde: Hilma – julkiset hankinnat (hankintailmoitukset.fi), julkinen hakuindeksi.
 *
 * Kuten `hae_julkiset_hankinnat_hilma`, mutta palauttaa YHDEN parhaiten osuvan
 * ilmoituksen KAIKKI olennaiset tiedot: kuvaus kokonaisuudessaan, arvioitu arvo,
 * menettely, CPV-koodit, osat (lots), vastuullisuuskriteerit, TED-numero ja linkit.
 * Käytä kun haluat syventyä yhteen hankintaan.
 */

import { z } from "zod";

import type { ToolDefinition } from "./types.js";

const SEARCH_URL = "https://www.hankintailmoitukset.fi/search/eformnotices";
const NOTICE_BASE =
  "https://www.hankintailmoitukset.fi/fi/public/procurement";
const REQUEST_TIMEOUT_MS = 15_000;
const TZ = "Europe/Helsinki";

export const haeHankintailmoitusInputSchema = {
  hakusana: z
    .string()
    .min(1)
    .describe(
      "Hakusana tai ilmoitusnumero (esim. \"2024-004717\", \"tietoturvan konsultointi 2M-IT\").",
    ),
  vain_aktiiviset: z
    .boolean()
    .default(false)
    .describe("Jos true, huomioidaan vain ilmoitukset joiden määräaika ei ole umpeutunut."),
};

interface Lohko {
  titleFi?: string;
  procurementTypeCode?: string;
  estimatedValue?: number;
}

interface Ilmoitus {
  id?: string;
  noticeId?: number;
  procedureId?: number;
  noticeNumber?: string;
  datePublished?: string;
  deadline?: string;
  expirationDate?: string;
  mainType?: string;
  procedureType?: string;
  procurementTypeCode?: string;
  titleFi?: string;
  titleEn?: string;
  titleSv?: string;
  organisationNameFi?: string;
  organisationNameEn?: string;
  organisationNationalRegistrationNumber?: string;
  organisationAddress?: string;
  cpvCodes?: string;
  estimatedValue?: number;
  currency?: string;
  descriptionFi?: string;
  descriptionEn?: string;
  procurementDocumentsUrl?: string;
  isEuProcurement?: boolean;
  isNationalProcurement?: boolean;
  includesFrameworkAgreement?: boolean;
  includesDynamicPurcharingSystem?: boolean;
  isCorrigendum?: boolean;
  isCancelled?: boolean;
  tedPublicationId?: string;
  previousNoticeNumber?: string[];
  lots?: Lohko[];
  [flag: string]: unknown;
}

interface Vastaus {
  value?: Ilmoitus[];
}

const MAIN_TYPE: Record<string, string> = {
  ContractNotices: "Hankintailmoitus",
  ContractAwardNotices: "Jälki-ilmoitus (hankintapäätös tehty)",
  PriorInformationNotices: "Ennakkoilmoitus",
  ContractModificationNotices: "Sopimusmuutosilmoitus",
};
const PROC_TYPE: Record<string, string> = {
  open: "avoin menettely",
  restricted: "rajoitettu menettely",
  "competitive-dialogue": "kilpailullinen neuvottelumenettely",
  negotiated: "neuvottelumenettely",
  "innovation-partnership": "innovaatiokumppanuus",
};
const KOHDE_TYPE: Record<string, string> = {
  services: "Palvelut",
  supplies: "Tavarat",
  works: "Rakennusurakka",
};
const VASTUULLISUUS: Record<string, string> = {
  biodiversity: "luonnon monimuotoisuus",
  circularEconomy: "kiertotalous",
  codeOfConduct: "toimintaohjeisto (Code of Conduct)",
  employmentCondition: "työllistämisehto",
  energyEfficiencyConsidered: "energiatehokkuus",
  innovationConsidered: "innovaatio",
  justWorkingConditions: "oikeudenmukaiset työehdot",
  lowCarbon: "vähähiilisyys",
  smeParticipationConsidered: "pk-yritysten osallistuminen",
  solutionNewToBuyer: "ostajalle uusi ratkaisu",
  sustainableFoodProduction: "kestävä ruoantuotanto",
};

function teksti(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function ekaEiTyhja(...v: (string | undefined)[]): string | undefined {
  return v.find((x) => typeof x === "string" && x.trim().length > 0)?.trim();
}

function pvm(iso?: string): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fi-FI", {
    timeZone: TZ,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function raha(arvo?: number, valuutta?: string): string | undefined {
  if (typeof arvo !== "number" || arvo <= 0) return undefined;
  const luku = arvo.toLocaleString("fi-FI").replace(/[  ]/g, " ");
  return `${luku} ${valuutta || "EUR"}`;
}

async function haeJson(url: URL): Promise<Vastaus> {
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
      throw new Error(`Hilma palautti HTTP ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as Vastaus;
  } finally {
    clearTimeout(timeout);
  }
}

export async function haeHankintailmoitus({
  hakusana,
  vain_aktiiviset = false,
}: {
  hakusana: string;
  vain_aktiiviset?: boolean;
}) {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("search", hakusana.trim());
  url.searchParams.set("$top", "1");
  if (vain_aktiiviset) {
    url.searchParams.set(
      "$filter",
      `deadline gt ${new Date().toISOString().split(".")[0]}Z`,
    );
  }

  let data: Vastaus;
  try {
    data = await haeJson(url);
  } catch (err) {
    const viesti =
      err instanceof Error && err.name === "AbortError"
        ? `Hilma-haku aikakatkaistiin (${REQUEST_TIMEOUT_MS} ms).`
        : `Hilma-haku epäonnistui: ${(err as Error).message}`;
    return teksti(viesti);
  }

  const n = data.value?.[0];
  if (!n) {
    return teksti(
      `Ei hankintailmoitusta haulla "${hakusana}"${vain_aktiiviset ? " (vain aktiiviset)" : ""}.`,
    );
  }

  const rivit: string[] = [
    ekaEiTyhja(n.titleFi, n.titleEn, n.titleSv) ?? "(ei otsikkoa)",
    "",
    `Ilmoitusnumero:   ${n.noticeNumber ?? "–"}${n.isCorrigendum ? "  (korjausilmoitus)" : ""}${n.isCancelled ? "  (PERUTTU)" : ""}`,
    `Tyyppi:           ${MAIN_TYPE[n.mainType ?? ""] ?? n.mainType ?? "–"}` +
      (n.procedureType ? `, ${PROC_TYPE[n.procedureType] ?? n.procedureType}` : ""),
    `Hankinnan laji:   ${KOHDE_TYPE[n.procurementTypeCode ?? ""] ?? n.procurementTypeCode ?? "–"}`,
    `Hankintayksikkö:  ${ekaEiTyhja(n.organisationNameFi, n.organisationNameEn) ?? "–"}` +
      (n.organisationNationalRegistrationNumber
        ? ` (Y-tunnus ${n.organisationNationalRegistrationNumber})`
        : ""),
  ];
  if (n.organisationAddress) rivit.push(`Osoite:           ${n.organisationAddress}`);
  rivit.push(
    `Julkaistu:        ${pvm(n.datePublished)}`,
    `Määräaika:        ${pvm(n.deadline ?? n.expirationDate)}`,
  );

  const laajuus: string[] = [];
  if (n.isEuProcurement) laajuus.push("EU-kynnysarvon ylittävä");
  else if (n.isNationalProcurement) laajuus.push("kansallinen");
  if (n.includesFrameworkAgreement) laajuus.push("puitejärjestely");
  if (n.includesDynamicPurcharingSystem) laajuus.push("dynaaminen hankintajärjestelmä (DPS)");
  if (laajuus.length) rivit.push(`Laajuus:          ${laajuus.join(", ")}`);

  const arvo = raha(n.estimatedValue, n.currency);
  if (arvo) rivit.push(`Arvioitu arvo:    ${arvo}`);

  if (n.cpvCodes) rivit.push(`CPV-koodit:       ${n.cpvCodes.split(/\s+/).join(", ")}`);

  const vastuullisuus = Object.entries(VASTUULLISUUS)
    .filter(([k]) => n[k] === true)
    .map(([, v]) => v);
  if (vastuullisuus.length) {
    rivit.push(`Vastuullisuus:    ${vastuullisuus.join(", ")}`);
  }

  const lots = (n.lots ?? []).filter((l) => l.titleFi);
  if (lots.length) {
    rivit.push(
      `Osat (${lots.length}):`,
      ...lots.map((l) => `  - ${l.titleFi}`),
    );
  }

  if (n.previousNoticeNumber?.length) {
    rivit.push(`Edellinen ilmoitus: ${n.previousNoticeNumber.join(", ")}`);
  }
  if (n.tedPublicationId) rivit.push(`TED-numero:        ${n.tedPublicationId}`);

  const kuvaus = ekaEiTyhja(n.descriptionFi, n.descriptionEn);
  if (kuvaus) rivit.push("", "Kuvaus:", kuvaus);

  rivit.push("");
  if (n.procedureId && n.noticeId) {
    rivit.push(
      `Ilmoitus:      ${NOTICE_BASE}/${n.procedureId}/notice/${n.noticeId}/overview`,
    );
  } else if (n.noticeId) {
    rivit.push(
      `Ilmoitus:      https://www.hankintailmoitukset.fi/fi/public/notice/${n.noticeId}`,
    );
  }
  if (n.procurementDocumentsUrl) {
    rivit.push(`Tarjouspyyntö: ${n.procurementDocumentsUrl}`);
  }

  return teksti(rivit.join("\n"));
}

export const tool: ToolDefinition<{
  hakusana: string;
  vain_aktiiviset?: boolean;
}> = {
  name: "hae_hankintailmoitus",
  title: "Hae yhden hankinnan tiedot (Hilma)",
  description:
    "Palauttaa yhden Hilma-hankintailmoituksen kaikki olennaiset tiedot: koko " +
    "kuvaus, arvioitu arvo, menettely, CPV-koodit, osat, vastuullisuuskriteerit, " +
    "TED-numero ja linkit. Anna hakusana tai ilmoitusnumero. Täydentää " +
    "hae_julkiset_hankinnat_hilma -listahakua.",
  inputSchema: haeHankintailmoitusInputSchema,
  handler: (args) => haeHankintailmoitus(args),
};
