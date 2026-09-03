import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, stubFetchOnce } from "../test-utils.js";
import { haeHankintailmoitus } from "./hankintailmoitus.js";

const notice = {
  id: "EF-4717",
  noticeId: 4717,
  procedureId: 3846,
  noticeNumber: "2024-004717",
  datePublished: "2024-01-27T10:30:02.448Z",
  deadline: "2028-03-01T08:00:00Z",
  mainType: "ContractNotices",
  procedureType: "restricted",
  procurementTypeCode: "services",
  titleFi: "Tietoturvan ja tietosuojan konsultointipalvelut",
  organisationNameFi: "2M-IT Oy",
  organisationNationalRegistrationNumber: "2859795-3",
  organisationAddress: "Joukahaisenkatu 9 B 20520 Turku FIN",
  cpvCodes: "72000000 48730000 72100000",
  estimatedValue: 600000.0,
  currency: "EUR",
  descriptionFi:
    "Tietoturvan ja tietosuojan konsultointipalvelut 2M-IT Oy:lle puitejärjestelynä.",
  procurementDocumentsUrl: "https://tarjouspalvelu.fi/2m?id=488474",
  isEuProcurement: true,
  includesDynamicPurcharingSystem: true,
  smeParticipationConsidered: true,
  innovationConsidered: false,
  tedPublicationId: "58725-2024",
  previousNoticeNumber: ["2023-000001"],
  lots: [{ titleFi: "Osa 1: tietoturvakonsultointi" }, { titleFi: null }],
};

afterEach(() => vi.restoreAllMocks());

describe("hae_hankintailmoitus", () => {
  it("renderöi yhden ilmoituksen kaikki olennaiset tiedot", async () => {
    const fetchMock = stubFetchOnce(jsonResponse({ value: [notice] }));

    const res = await haeHankintailmoitus({ hakusana: "tietoturva 2M-IT" });

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("search=tietoturva+2M-IT");
    expect(url).toContain("%24top=1");

    const t = res.content[0]!.text;
    expect(t).toContain("Tietoturvan ja tietosuojan konsultointipalvelut");
    expect(t).toContain("2024-004717");
    expect(t).toContain("Hankintailmoitus, rajoitettu menettely");
    expect(t).toContain("Palvelut");
    expect(t).toContain("2M-IT Oy (Y-tunnus 2859795-3)");
    expect(t).toContain("600 000 EUR");
    expect(t).toContain("72000000, 48730000, 72100000");
    expect(t).toContain("dynaaminen hankintajärjestelmä (DPS)");
    expect(t).toContain("pk-yritysten osallistuminen");
    expect(t).not.toContain("innovaatio"); // false-flag ei mukana
    expect(t).toContain("Osa 1: tietoturvakonsultointi");
    expect(t).toContain("Edellinen ilmoitus: 2023-000001");
    expect(t).toContain("TED-numero:        58725-2024");
    expect(t).toContain("puitejärjestelynä"); // koko kuvaus
    expect(t).toContain("/procurement/3846/notice/4717/overview");
    expect(t).toContain("tarjouspalvelu.fi/2m");
  });

  it("vain_aktiiviset lisää deadline-filtterin", async () => {
    const fetchMock = stubFetchOnce(jsonResponse({ value: [notice] }));
    await haeHankintailmoitus({ hakusana: "x", vain_aktiiviset: true });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("deadline+gt");
  });

  it("ei osumaa -> selkeä viesti", async () => {
    stubFetchOnce(jsonResponse({ value: [] }));
    const res = await haeHankintailmoitus({ hakusana: "eiloydy" });
    expect(res.content[0]!.text).toMatch(/Ei hankintailmoitusta/i);
  });
});
