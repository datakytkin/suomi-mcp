import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, stubFetchRoutes, textResponse } from "../test-utils.js";
import { haeKaupparekisteriMuutoksetPrh } from "./kaupparekisteri.js";

const EC_LIST = ["HAL\t\tHALLITUS", "NIMO\t\tNIMENKIRJOITTAMISOIKEUDET/EDUSTAMISOIKEUDET", "TASE\t\tTILINPÄÄTÖSASIAKIRJAT"].join("\r\n");
const NRT_LIST = ["M\t\tMuutosilmoitus", "TA\t\tTilinpäätös", "U\t\tPerusilmoitus"].join("\r\n");

const company = {
  businessId: { value: "1629284-5", registrationDate: "2000-11-07" },
  names: [{ name: "Reaktor Innovations Oy", type: "1" }],
  mainBusinessLine: {
    type: "62100",
    descriptions: [
      { languageCode: "1", description: "Ohjelmistojen suunnittelu ja valmistus" },
    ],
  },
  website: { url: "www.reaktor.fi" },
  companyForms: [
    { type: "16", descriptions: [{ languageCode: "1", description: "Osakeyhtiö" }] },
  ],
  companySituations: [],
  registeredEntries: [
    { register: "1", descriptions: [{ languageCode: "1", description: "Rekisterissä" }] },
  ],
  addresses: [
    {
      type: 1,
      street: "Yliopistonkatu",
      postCode: "00100",
      postOffices: [{ city: "HELSINKI", languageCode: "1" }],
    },
  ],
  publicNotices: [
    { registrationDate: "2026-07-04", recordNumber: "2026/51791W", typeOfRegistration: "TA", entryCodes: ["TASE"] },
    { registrationDate: "2026-02-02", recordNumber: "2026/050579", typeOfRegistration: "M", entryCodes: ["NIMO", "HAL"] },
    { registrationDate: "2026-02-02", recordNumber: "2026/050579", typeOfRegistration: "M", entryCodes: ["NIMO", "HAL"] },
  ],
  tradeRegisterStatus: "1",
  status: "2",
  registrationDate: "2000-10-04",
};

function routes(main: () => ReturnType<typeof jsonResponse>) {
  return stubFetchRoutes([
    { match: "code=EC", response: () => textResponse(EC_LIST) },
    { match: "code=NRT", response: () => textResponse(NRT_LIST) },
    { match: "/opendata-registerednotices-api", response: main },
  ]);
}

afterEach(() => vi.restoreAllMocks());

describe("haeKaupparekisteriMuutokset_prh", () => {
  it("Y-tunnushaku: perustiedot + aikajana, koodit purettu, duplikaatit poistettu", async () => {
    routes(() => jsonResponse(company));

    const res = await haeKaupparekisteriMuutoksetPrh({ hakusana: "1629284-5", max_tulokset: 10 });
    const text = res.content[0]!.text;

    expect(text).toContain("Reaktor Innovations Oy");
    expect(text).toContain("TOL 62100");
    expect(text).toContain("Helsinki");
    expect(text).toContain("www.reaktor.fi");
    // NRT + EC koodit purettu suomeksi:
    expect(text).toContain("Muutosilmoitus");
    expect(text).toContain("Hallitus");
    expect(text).toContain("Tilinpäätös");
    // 3 publicNotices, joista 2 samaa recordNumberia -> 2 riviä
    expect(text).toContain("2/2");
    expect((text.match(/2026-02-02/g) ?? []).length).toBe(1);
  });

  it("konkurssi/saneeraus nostetaan varoitusrivinä", async () => {
    routes(() =>
      jsonResponse({
        ...company,
        companySituations: [
          {
            type: "KONK",
            descriptions: [{ languageCode: "1", description: "Konkurssi" }],
            registrationDate: "2025-03-01",
          },
        ],
      }),
    );

    const res = await haeKaupparekisteriMuutoksetPrh({ hakusana: "1629284-5" });
    expect(res.content[0]!.text).toMatch(/Yritystilanne:.*Konkurssi \(2025-03-01\)/);
  });

  it("ei tuloksia (404) -> selkeä viesti", async () => {
    stubFetchRoutes([
      { match: "code=EC", response: () => textResponse(EC_LIST) },
      { match: "code=NRT", response: () => textResponse(NRT_LIST) },
      { match: "/opendata-registerednotices-api", response: () => jsonResponse(null, 404) },
    ]);

    const res = await haeKaupparekisteriMuutoksetPrh({ hakusana: "9999999-9" });
    expect(res.content[0]!.text).toContain("Ei tuloksia");
  });
});
