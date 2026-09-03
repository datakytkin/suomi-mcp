import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, stubFetchOnce } from "../test-utils.js";
import { haeYritystiedotPrh } from "./prh.js";

const reaktor = {
  businessId: { value: "1629284-5", registrationDate: "2000-11-07", source: "3" },
  names: [
    {
      name: "Reaktor Innovations Oy",
      type: "1",
      registrationDate: "2000-10-04",
      source: "1",
      version: 1,
    },
    {
      name: "REAKTOR CREATIVE",
      type: "3",
      registrationDate: "2021-10-05",
      source: "1",
      version: 1,
    },
  ],
  companyForms: [
    {
      type: "16",
      descriptions: [
        { languageCode: "1", description: "Osakeyhtiö" },
        { languageCode: "3", description: "Limited company" },
      ],
      registrationDate: "2000-10-04",
      source: "1",
      version: 1,
    },
  ],
  registeredEntries: [
    {
      type: "1",
      register: "1",
      authority: "2",
      descriptions: [{ languageCode: "1", description: "Rekisterissä" }],
      registrationDate: "2000-10-04",
    },
    {
      type: "5",
      register: "5",
      descriptions: [{ languageCode: "1", description: "Rekisterissä" }],
    },
    {
      type: "80",
      register: "6",
      descriptions: [
        { languageCode: "1", description: "Liiketoiminnasta arvonlisäverovelvollinen" },
      ],
    },
  ],
  mainBusinessLine: {
    type: "62100",
    descriptions: [
      { languageCode: "1", description: "Ohjelmistojen suunnittelu ja valmistus" },
      { languageCode: "3", description: "Computer programming activities" },
    ],
  },
  website: { url: "www.reaktor.fi" },
  addresses: [
    {
      type: 1,
      street: "Yliopistonkatu",
      postCode: "00100",
      postOffices: [
        { city: "HELSINGFORS", languageCode: "2" },
        { city: "HELSINKI", languageCode: "1" },
      ],
    },
  ],
  registrationDate: "2000-10-04",
  endDate: null,
  status: "2",
  tradeRegisterStatus: "1",
};

afterEach(() => vi.restoreAllMocks());

describe("haeYritystiedot_prh", () => {
  it("Y-tunnushaku käyttää businessId-parametria ja muotoilee yhteenvedon", async () => {
    const fetchMock = stubFetchOnce(
      jsonResponse({ totalResults: 1, companies: [reaktor] }),
    );

    const res = await haeYritystiedotPrh({ hakusana: "1629284-5" });

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("businessId=1629284-5");
    const text = res.content[0]!.text;
    expect(text).toContain("Reaktor Innovations Oy");
    expect(text).toContain("1629284-5");
    expect(text).toContain("Osakeyhtiö");
    expect(text).toContain("REAKTOR CREATIVE"); // aputoiminimi
    // YTJ-laajennus:
    expect(text).toContain("Ohjelmistojen suunnittelu ja valmistus (TOL 62100)");
    expect(text).toContain("Kotipaikka:        Helsinki");
    expect(text).toContain("www.reaktor.fi");
    expect(text).toContain("Ennakkoperintärekisteri: Rekisterissä");
    expect(text).toContain(
      "Arvonlisäverovelvollisuus: Liiketoiminnasta arvonlisäverovelvollinen",
    );
  });

  it("nimihaku käyttää name-parametria ja listaa useat osumat", async () => {
    const fetchMock = stubFetchOnce(
      jsonResponse({
        totalResults: 2,
        companies: [
          reaktor,
          { ...reaktor, businessId: { value: "1234567-8" } },
        ],
      }),
    );

    const res = await haeYritystiedotPrh({ hakusana: "Reaktor" });

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("name=Reaktor");
    expect(res.content[0]!.text).toContain("löytyi 2 osumaa");
    expect(res.content[0]!.text).toContain("1234567-8");
  });

  it("ei tuloksia -> selkeä viesti, ei heitä", async () => {
    stubFetchOnce(jsonResponse({ totalResults: 0, companies: [] }));
    const res = await haeYritystiedotPrh({ hakusana: "9999999-9" });
    expect(res.content[0]!.text).toContain("Ei tuloksia");
  });

  it("HTTP 500 -> virheteksti, ei heitä", async () => {
    stubFetchOnce(jsonResponse({}, 500));
    const res = await haeYritystiedotPrh({ hakusana: "1629284-5" });
    expect(res.content[0]!.text).toMatch(/epäonnistui|HTTP 500/i);
  });
});
