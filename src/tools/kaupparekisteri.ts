/**
 * Työkalu: hae_kaupparekisteri_muutokset_prh
 *
 * Lähde: PRH – Rekisteröidyt ilmoitukset (avoin data, keyless, CC BY 4.0)
 *   https://avoindata.prh.fi/opendata-registerednotices-api/v3
 *
 * Antaa yrityksen perustiedot JA aikajanan kaupparekisteriin rekisteröidyistä
 * ilmoituksista (hallitusmuutokset, nimenmuutokset, tilinpäätökset, osakepääoma,
 * konkurssi/saneeraus/selvitystila jne.). Täysi kattavuus – toisin kuin
 * digitaaliset tilinpäätökset, tämä koskee kaikkia kaupparekisteriyrityksiä.
 */

import { z } from "zod";

const RN_BASE = "https://avoindata.prh.fi/opendata-registerednotices-api/v3";
const REQUEST_TIMEOUT_MS = 15_000;

/** Y-tunnus muodossa 1234567-8 (myös 6-numeroinen alkuosa sallitaan). */
const YTUNNUS_RE = /^\d{6,7}-\d$/;

/* -------------------------------------------------------------------------- */
/* Input schema                                                               */
/* -------------------------------------------------------------------------- */

export const haeKaupparekisteriMuutoksetPrhInputSchema = {
  hakusana: z
    .string()
    .min(1, "Anna Y-tunnus tai yrityksen nimi.")
    .describe(
      "Y-tunnus muodossa 1234567-8 TAI yrityksen nimi / sen osa (esim. \"Reaktor\").",
    ),
  max_tulokset: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Kuinka monta viimeisintä rekisteröityä ilmoitusta näytetään (oletus 10)."),
};

/* -------------------------------------------------------------------------- */
/* Tyypit (löysät – rajapinta voi lisätä kenttiä)                             */
/* -------------------------------------------------------------------------- */

interface Kuvaus {
  languageCode?: string; // "1" fi, "2" sv, "3" en
  description?: string;
}

interface Nimi {
  name?: string;
  type?: string; // "1" toiminimi, "2" rinnakkaistoiminimi, "3" aputoiminimi
  registrationDate?: string;
  endDate?: string;
}

interface Yritysmuoto {
  type?: string;
  descriptions?: Kuvaus[];
  endDate?: string;
}

interface Toimiala {
  type?: string; // TOL 2008 -koodi
  descriptions?: Kuvaus[];
}

interface RekisteriMerkinta {
  register?: string; // "1" = kaupparekisteri
  endDate?: string;
  descriptions?: Kuvaus[];
}

interface Yritystilanne {
  type?: string; // SANE / KONK / SELTILA ...
  descriptions?: Kuvaus[];
  registrationDate?: string;
  endDate?: string;
}

interface PostiOsoite {
  city?: string;
  languageCode?: string;
}

interface Osoite {
  type?: number; // 1 = käynti, 2 = posti
  street?: string;
  postCode?: string;
  postOffices?: PostiOsoite[];
}

interface Ilmoitus {
  registrationDate?: string;
  recordNumber?: string;
  typeOfRegistration?: string; // NRT-koodi
  entryCodes?: string[]; // EC-koodit
}

interface Yritys {
  businessId?: { value?: string; registrationDate?: string };
  names?: Nimi[];
  mainBusinessLine?: Toimiala;
  website?: { url?: string };
  companyForms?: Yritysmuoto[];
  companySituations?: Yritystilanne[];
  registeredEntries?: RekisteriMerkinta[];
  addresses?: Osoite[];
  publicNotices?: Ilmoitus[];
  tradeRegisterStatus?: string;
  status?: string;
  registrationDate?: string;
  endDate?: string;
}

interface HakuVastaus {
  totalResults?: number;
  companies?: Yritys[];
}

/* -------------------------------------------------------------------------- */
/* Koodilistat (haetaan kerran, pidetään muistissa prosessin eliniän)         */
/* -------------------------------------------------------------------------- */

const koodilistaCache = new Map<string, Map<string, string>>();

async function koodilista(code: "EC" | "NRT"): Promise<Map<string, string>> {
  const valmis = koodilistaCache.get(code);
  if (valmis) return valmis;

  const map = new Map<string, string>();
  try {
    const url = new URL(`${RN_BASE}/description`);
    url.searchParams.set("code", code);
    url.searchParams.set("lang", "FI");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "text/plain",
          "User-Agent":
            "datakytkin-mcp/0.1 (+https://github.com/datakytkin/suomi-mcp)",
        },
        signal: controller.signal,
      });
      if (res.ok) {
        const teksti = await res.text();
        for (const rivi of teksti.split(/\r?\n/)) {
          const osat = rivi.split(/\t+/);
          if (osat.length >= 2 && osat[0]) {
            const koodi = osat[0].trim();
            const selite = osat[osat.length - 1]?.trim();
            if (koodi && selite) map.set(koodi, selite);
          }
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Jätetään map tyhjäksi -> näytetään raa'at koodit.
  }

  koodilistaCache.set(code, map);
  return map;
}

function seliteTaiKoodi(map: Map<string, string>, koodi?: string): string {
  if (!koodi) return "";
  const s = map.get(koodi);
  if (!s) return koodi;
  // "OSAKEPÄÄOMAN ALENTAMINEN" -> "Osakepääoman alentaminen"
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/* -------------------------------------------------------------------------- */
/* Apufunktiot                                                                */
/* -------------------------------------------------------------------------- */

function suomeksi(kuvaukset?: Kuvaus[]): string | undefined {
  if (!kuvaukset?.length) return undefined;
  return (
    kuvaukset.find((k) => k.languageCode === "1")?.description ??
    kuvaukset.find((k) => k.languageCode === "3")?.description ??
    kuvaukset[0]?.description
  );
}

function nykyinenNimi(y: Yritys): string {
  const nimet = y.names ?? [];
  const voimassa = nimet.filter((n) => n.name && !n.endDate);
  const paa =
    voimassa.find((n) => n.type === "1") ??
    voimassa[0] ??
    [...nimet]
      .filter((n) => n.name)
      .sort((a, b) =>
        (b.registrationDate ?? "").localeCompare(a.registrationDate ?? ""),
      )[0];
  return paa?.name ?? "(nimi ei tiedossa)";
}

function yritysmuoto(y: Yritys): string {
  const muodot = y.companyForms ?? [];
  const voimassa = muodot.find((m) => !m.endDate) ?? muodot[muodot.length - 1];
  return (voimassa && suomeksi(voimassa.descriptions)) ?? "(ei tiedossa)";
}

function toimiala(y: Yritys): string | undefined {
  const t = y.mainBusinessLine;
  const kuvaus = suomeksi(t?.descriptions);
  if (!kuvaus && !t?.type) return undefined;
  return t?.type ? `${kuvaus ?? "?"} (TOL ${t.type})` : kuvaus;
}

function kotipaikka(y: Yritys): string | undefined {
  for (const o of y.addresses ?? []) {
    const kaupunki =
      o.postOffices?.find((p) => p.languageCode === "1")?.city ??
      o.postOffices?.[0]?.city;
    if (kaupunki) {
      return kaupunki.charAt(0) + kaupunki.slice(1).toLowerCase();
    }
  }
  return undefined;
}

function kaupparekisterinTila(y: Yritys): string {
  if (y.endDate) return `Poistettu rekisteristä ${y.endDate}`;
  const kr = (y.registeredEntries ?? []).find(
    (e) => e.register === "1" && !e.endDate,
  );
  const tila = suomeksi(kr?.descriptions);
  return tila ?? (y.tradeRegisterStatus === "1" ? "Rekisterissä" : "Tuntematon");
}

function yritystilanteet(y: Yritys): string[] {
  return (y.companySituations ?? [])
    .filter((s) => !s.endDate)
    .map((s) => {
      const nimi = suomeksi(s.descriptions) ?? s.type ?? "yritystilanne";
      return s.registrationDate ? `${nimi} (${s.registrationDate})` : nimi;
    });
}

function teksti(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

async function haeJson(url: URL): Promise<unknown> {
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
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`PRH-rajapinta palautti HTTP ${res.status} ${res.statusText}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/* -------------------------------------------------------------------------- */
/* Muotoilu                                                                   */
/* -------------------------------------------------------------------------- */

function muotoileYritys(
  y: Yritys,
  maxTulokset: number,
  ecKoodit: Map<string, string>,
  nrtKoodit: Map<string, string>,
): string {
  const rivit: string[] = [
    `Nimi:            ${nykyinenNimi(y)}`,
    `Y-tunnus:        ${y.businessId?.value ?? "(ei tiedossa)"}`,
    `Yritysmuoto:     ${yritysmuoto(y)}`,
  ];
  const ala = toimiala(y);
  if (ala) rivit.push(`Toimiala:        ${ala}`);
  const paikka = kotipaikka(y);
  if (paikka) rivit.push(`Kotipaikka:      ${paikka}`);
  if (y.website?.url) rivit.push(`Verkkosivu:      ${y.website.url}`);
  rivit.push(
    `Rekisteröity:    ${y.registrationDate ?? y.businessId?.registrationDate ?? "(ei tiedossa)"}`,
  );
  rivit.push(`Kaupparekisteri: ${kaupparekisterinTila(y)}`);

  const tilanteet = yritystilanteet(y);
  if (tilanteet.length) {
    rivit.push(`⚠ Yritystilanne: ${tilanteet.join("; ")}`);
  }

  // Rekisteröidyt ilmoitukset: dedupe recordNumberin mukaan, uusin ensin.
  const nahdyt = new Set<string>();
  const ilmoitukset = [...(y.publicNotices ?? [])]
    .sort((a, b) =>
      (b.registrationDate ?? "").localeCompare(a.registrationDate ?? ""),
    )
    .filter((i) => {
      const avain = `${i.registrationDate}|${i.recordNumber}`;
      if (nahdyt.has(avain)) return false;
      nahdyt.add(avain);
      return true;
    });

  rivit.push("");
  if (ilmoitukset.length === 0) {
    rivit.push("Ei rekisteröityjä ilmoituksia saatavilla.");
    return rivit.join("\n");
  }

  rivit.push(
    `Viimeisimmät rekisteröidyt ilmoitukset (näytetään ${Math.min(
      ilmoitukset.length,
      maxTulokset,
    )}/${ilmoitukset.length}, uusin ensin):`,
  );
  for (const i of ilmoitukset.slice(0, maxTulokset)) {
    const tyyppi = seliteTaiKoodi(nrtKoodit, i.typeOfRegistration);
    const aiheet = (i.entryCodes ?? [])
      .map((c) => seliteTaiKoodi(ecKoodit, c))
      .filter(Boolean)
      .join(", ");
    const pvm = i.registrationDate ?? "????-??-??";
    rivit.push(`  ${pvm}  ${tyyppi}${aiheet ? ` — ${aiheet}` : ""}`);
  }
  return rivit.join("\n");
}

/* -------------------------------------------------------------------------- */
/* Työkalun toteutus                                                          */
/* -------------------------------------------------------------------------- */

export async function haeKaupparekisteriMuutoksetPrh({
  hakusana,
  max_tulokset = 10,
}: {
  hakusana: string;
  max_tulokset?: number;
}) {
  const haku = hakusana.trim();
  const onYtunnus = YTUNNUS_RE.test(haku);

  let data: unknown;
  try {
    if (onYtunnus) {
      data = await haeJson(new URL(`${RN_BASE}/${encodeURIComponent(haku)}`));
    } else {
      const url = new URL(`${RN_BASE}/`);
      url.searchParams.set("name", haku);
      data = await haeJson(url);
    }
  } catch (err) {
    const viesti =
      err instanceof Error && err.name === "AbortError"
        ? `PRH-haku aikakatkaistiin (${REQUEST_TIMEOUT_MS} ms).`
        : `PRH-haku epäonnistui: ${(err as Error).message}`;
    return teksti(viesti);
  }

  // Y-tunnushaku palauttaa yhden Yritys-objektin; nimihaku { totalResults, companies }.
  let yritykset: Yritys[];
  let kokonais: number | undefined;
  if (data && typeof data === "object" && "companies" in data) {
    const v = data as HakuVastaus;
    yritykset = v.companies ?? [];
    kokonais = v.totalResults;
  } else if (data && typeof data === "object" && "businessId" in data) {
    yritykset = [data as Yritys];
  } else {
    yritykset = [];
  }

  if (yritykset.length === 0) {
    return teksti(
      `Ei tuloksia haulle "${haku}".\n` +
        (onYtunnus
          ? "Tarkista Y-tunnuksen muoto (esim. 2748452-4)."
          : "Kokeile eri kirjoitusasua tai vain osaa nimestä."),
    );
  }

  if (onYtunnus || yritykset.length === 1) {
    const [ec, nrt] = await Promise.all([koodilista("EC"), koodilista("NRT")]);
    return teksti(muotoileYritys(yritykset[0] as Yritys, max_tulokset, ec, nrt));
  }

  const naytetaan = Math.min(yritykset.length, 10);
  const listaus = yritykset
    .slice(0, naytetaan)
    .map(
      (y, i) =>
        `${i + 1}. ${nykyinenNimi(y)} — Y-tunnus ${
          y.businessId?.value ?? "?"
        } (${yritysmuoto(y)})`,
    )
    .join("\n");

  return teksti(
    `Haulla "${haku}" löytyi ${kokonais ?? yritykset.length} osumaa. Näytetään ${naytetaan} ensimmäistä:\n\n` +
      `${listaus}\n\n` +
      `Tarkenna hakua Y-tunnuksella nähdäksesi yhden yrityksen rekisteröidyt ilmoitukset.`,
  );
}
