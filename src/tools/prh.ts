/**
 * Työkalu: hae_yritystiedot_prh
 *
 * Lähde: PRH / YTJ avoin data, rajapinta v3
 *   https://avoindata.prh.fi/opendata-ytj-api/v3/companies
 *
 * Huom: vanha /bis/v1-rajapinta on poistettu käytöstä. Tämä toteutus käyttää
 * nykyistä v3-rajapintaa, joka on toiminnallisesti sama avoin YTJ-yrityshaku.
 */

import { z } from "zod";

import type { ToolDefinition } from "./types.js";

const PRH_BASE = "https://avoindata.prh.fi/opendata-ytj-api/v3";
const REQUEST_TIMEOUT_MS = 15_000;

/** Y-tunnus muodossa 1234567-8 (myös 6-numeroinen alkuosa sallitaan). */
const YTUNNUS_RE = /^\d{6,7}-\d$/;

/* -------------------------------------------------------------------------- */
/* Input schema (rekisteröidään index.ts:ssä)                                 */
/* -------------------------------------------------------------------------- */

export const haeYritystiedotPrhInputSchema = {
  hakusana: z
    .string()
    .min(1, "Anna Y-tunnus tai yrityksen nimi.")
    .describe(
      "Y-tunnus muodossa 1234567-8 TAI yrityksen nimi / sen osa (esim. \"Reaktor\").",
    ),
};

/* -------------------------------------------------------------------------- */
/* PRH v3 -vastauksen tyypit (löysät – rajapinta voi lisätä kenttiä)          */
/* -------------------------------------------------------------------------- */

interface PrhKuvaus {
  languageCode?: string; // "1" = fi, "2" = sv, "3" = en
  description?: string;
}

interface PrhNimi {
  name?: string;
  type?: string; // "1" = toiminimi, "2" = rinnakkaistoiminimi, "3" = aputoiminimi
  registrationDate?: string;
  endDate?: string;
  version?: number;
  source?: string;
}

interface PrhYritysmuoto {
  type?: string;
  descriptions?: PrhKuvaus[];
  registrationDate?: string;
  endDate?: string;
}

interface PrhRekisterimerkinta {
  register?: string; // REK-koodilista, ks. REK-map alla
  authority?: string;
  type?: string;
  registrationDate?: string;
  endDate?: string;
  descriptions?: PrhKuvaus[];
}

interface PrhPostiosoite {
  city?: string;
  languageCode?: string;
}

interface PrhOsoite {
  type?: number;
  street?: string;
  postCode?: string;
  postOffices?: PrhPostiosoite[];
}

interface PrhYritys {
  businessId?: { value?: string; registrationDate?: string };
  names?: PrhNimi[];
  companyForms?: PrhYritysmuoto[];
  registeredEntries?: PrhRekisterimerkinta[];
  mainBusinessLine?: { type?: string; descriptions?: PrhKuvaus[] };
  website?: { url?: string };
  addresses?: PrhOsoite[];
  registrationDate?: string;
  endDate?: string;
  status?: string;
  tradeRegisterStatus?: string;
}

/** PRH:n rekisterikoodit (REK-koodilista). */
const REK: Record<string, string> = {
  "1": "Kaupparekisteri",
  "2": "Säätiörekisteri",
  "3": "Yhdistysrekisteri",
  "4": "Verohallinnon perustiedot",
  "5": "Ennakkoperintärekisteri",
  "6": "Arvonlisäverovelvollisuus",
  "7": "Työnantajarekisteri",
  "8": "Vakuutusmaksuverovelvollisten rekisteri",
};

interface PrhVastaus {
  totalResults?: number;
  companies?: PrhYritys[];
}

/* -------------------------------------------------------------------------- */
/* Apufunktiot                                                                */
/* -------------------------------------------------------------------------- */

function suomeksi(kuvaukset?: PrhKuvaus[]): string | undefined {
  if (!kuvaukset?.length) return undefined;
  return (
    kuvaukset.find((k) => k.languageCode === "1")?.description ??
    kuvaukset.find((k) => k.languageCode === "3")?.description ??
    kuvaukset[0]?.description
  );
}

function nykyinenNimi(yritys: PrhYritys): string {
  const nimet = yritys.names ?? [];
  const voimassa = nimet.filter((n) => n.name && !n.endDate);
  const paanimi =
    voimassa.find((n) => n.type === "1") ??
    voimassa[0] ??
    [...nimet]
      .filter((n) => n.name)
      .sort((a, b) =>
        (b.registrationDate ?? "").localeCompare(a.registrationDate ?? ""),
      )[0];
  return paanimi?.name ?? "(nimi ei tiedossa)";
}

function nykyinenYritysmuoto(yritys: PrhYritys): string {
  const muodot = yritys.companyForms ?? [];
  const voimassa = muodot.find((m) => !m.endDate) ?? muodot[muodot.length - 1];
  return (voimassa && suomeksi(voimassa.descriptions)) ?? "(ei tiedossa)";
}

function rekisterointipaiva(yritys: PrhYritys): string {
  return (
    yritys.registrationDate ??
    yritys.businessId?.registrationDate ??
    "(ei tiedossa)"
  );
}

function toiminnanTila(yritys: PrhYritys): string {
  if (yritys.endDate) return `Toiminta päättynyt ${yritys.endDate}`;

  const kaupparekisteri = (yritys.registeredEntries ?? []).find(
    (e) => e.register === "1" && !e.endDate,
  );
  const tila = suomeksi(kaupparekisteri?.descriptions);
  if (tila) return `${tila} (kaupparekisteri)`;

  // Fallback statuskoodilla, jos rekisterimerkintöjä ei saatu.
  if (yritys.status === "2") return "Aktiivinen";
  return "Tila tuntematon";
}

function aputoiminimet(yritys: PrhYritys): string[] {
  return (yritys.names ?? [])
    .filter((n) => n.type === "3" && n.name && !n.endDate)
    .map((n) => n.name as string);
}

function toimiala(yritys: PrhYritys): string | undefined {
  const t = yritys.mainBusinessLine;
  const kuvaus = suomeksi(t?.descriptions);
  if (!kuvaus && !t?.type) return undefined;
  return t?.type ? `${kuvaus ?? "?"} (TOL ${t.type})` : kuvaus;
}

function kotipaikka(yritys: PrhYritys): string | undefined {
  for (const o of yritys.addresses ?? []) {
    const kaupunki =
      o.postOffices?.find((p) => p.languageCode === "1")?.city ??
      o.postOffices?.[0]?.city;
    if (kaupunki) return kaupunki.charAt(0) + kaupunki.slice(1).toLowerCase();
  }
  return undefined;
}

/** Voimassa olevat rekisterimerkinnät: "Ennakkoperintärekisteri: Rekisterissä". */
function rekisterit(yritys: PrhYritys): string[] {
  const nähdyt = new Set<string>();
  const rivit: string[] = [];
  for (const e of yritys.registeredEntries ?? []) {
    if (e.endDate) continue;
    const nimi = REK[e.register ?? ""] ?? `Rekisteri ${e.register ?? "?"}`;
    const tila = suomeksi(e.descriptions) ?? "Rekisterissä";
    const rivi = `${nimi}: ${tila}`;
    if (!nähdyt.has(rivi)) {
      nähdyt.add(rivi);
      rivit.push(rivi);
    }
  }
  return rivit;
}

function muotoileYritys(yritys: PrhYritys): string {
  const rivit = [
    `Nimi:              ${nykyinenNimi(yritys)}`,
    `Y-tunnus:          ${yritys.businessId?.value ?? "(ei tiedossa)"}`,
    `Yritysmuoto:       ${nykyinenYritysmuoto(yritys)}`,
  ];
  const ala = toimiala(yritys);
  if (ala) rivit.push(`Toimiala:          ${ala}`);
  const paikka = kotipaikka(yritys);
  if (paikka) rivit.push(`Kotipaikka:        ${paikka}`);
  if (yritys.website?.url) rivit.push(`Verkkosivu:        ${yritys.website.url}`);
  rivit.push(
    `Rekisteröity:      ${rekisterointipaiva(yritys)}`,
    `Toiminnan tila:    ${toiminnanTila(yritys)}`,
  );

  const apu = aputoiminimet(yritys);
  if (apu.length) rivit.push(`Aputoiminimet:     ${apu.join(", ")}`);

  const rek = rekisterit(yritys);
  if (rek.length) rivit.push("Rekisterit:", ...rek.map((r) => `  ${r}`));

  return rivit.join("\n");
}

function teksti(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

async function haeJson(url: URL): Promise<PrhVastaus> {
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
        `PRH-rajapinta palautti HTTP ${res.status} ${res.statusText}`,
      );
    }
    return (await res.json()) as PrhVastaus;
  } finally {
    clearTimeout(timeout);
  }
}

/* -------------------------------------------------------------------------- */
/* Työkalun toteutus                                                          */
/* -------------------------------------------------------------------------- */

export async function haeYritystiedotPrh({
  hakusana,
}: {
  hakusana: string;
}) {
  const haku = hakusana.trim();
  const onYtunnus = YTUNNUS_RE.test(haku);

  const url = new URL(`${PRH_BASE}/companies`);
  if (onYtunnus) url.searchParams.set("businessId", haku);
  else url.searchParams.set("name", haku);

  let data: PrhVastaus;
  try {
    data = await haeJson(url);
  } catch (err) {
    const viesti =
      err instanceof Error && err.name === "AbortError"
        ? `PRH-haku aikakatkaistiin (${REQUEST_TIMEOUT_MS} ms).`
        : `PRH-haku epäonnistui: ${(err as Error).message}`;
    return teksti(viesti);
  }

  const yritykset = data.companies ?? [];

  if (yritykset.length === 0) {
    return teksti(
      `Ei tuloksia haulle "${haku}".\n` +
        (onYtunnus
          ? "Tarkista Y-tunnuksen muoto (esim. 2748452-4). Kaikkia julkisyhteisöjä ei löydy YTJ:stä."
          : "Kokeile eri kirjoitusasua tai vain osaa nimestä."),
    );
  }

  // Y-tunnushaku tai yksi osuma -> täydet tiedot.
  if (onYtunnus || yritykset.length === 1) {
    return teksti(muotoileYritys(yritykset[0] as PrhYritys));
  }

  // Nimihaku, useita osumia -> lyhyt listaus.
  const kokonais = data.totalResults ?? yritykset.length;
  const naytetaan = Math.min(yritykset.length, 10);
  const listaus = yritykset
    .slice(0, naytetaan)
    .map(
      (y, i) =>
        `${i + 1}. ${nykyinenNimi(y)} — Y-tunnus ${
          y.businessId?.value ?? "?"
        } (${nykyinenYritysmuoto(y)})`,
    )
    .join("\n");

  return teksti(
    `Haulla "${haku}" löytyi ${kokonais} osumaa. Näytetään ${naytetaan} ensimmäistä:\n\n` +
      `${listaus}\n\n` +
      `Tarkenna hakua Y-tunnuksella saadaksesi täydet tiedot yhdestä yrityksestä.`,
  );
}

/* -------------------------------------------------------------------------- */
/* Työkalumäärittely (rekisteri poimii tämän automaattisesti)                 */
/* -------------------------------------------------------------------------- */

export const tool: ToolDefinition<{ hakusana: string }> = {
  name: "hae_yritystiedot_prh",
  title: "Hae yritystiedot (PRH / YTJ)",
  description:
    "Hakee suomalaisen yrityksen perustiedot PRH:n avoimesta YTJ-rajapinnasta. " +
    "Anna joko Y-tunnus (1234567-8) tai yrityksen nimi. Palauttaa nimen, Y-tunnuksen, " +
    "yritysmuodon, rekisteröintipäivän ja toiminnan tilan.",
  inputSchema: haeYritystiedotPrhInputSchema,
  handler: (args) => haeYritystiedotPrh(args),
};
