import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, stubFetchOnce } from "../test-utils.js";
import { haeAsuntojenHinnat } from "./asuntohinnat.js";

/** json-stat2 -vastaus 13mu:n muodossa: dims [vuosi=1, pnro=1, talotyyppi=4, content=2]. */
const data = {
  label: "Vanhojen osakeasuntojen neliöhinnat …",
  id: ["timeperiod_y", "postinumeroalue_4_20220101", "talotyyppi_6_20131021", "contentscode"],
  size: [1, 1, 4, 2],
  value: [7371, 136, 7254, 152, 7353, 132, null, null],
  dimension: {
    timeperiod_y: { category: { index: { "2025": 0 } } },
    postinumeroalue_4_20220101: {
      category: {
        index: { "00100": 0 },
        label: { "00100": "00100  Helsinki keskusta - Etu-Töölö (Helsinki)" },
      },
    },
    talotyyppi_6_20131021: {
      category: {
        index: { "1": 0, "2": 1, "3": 2, "5": 3 },
        label: {
          "1": "Kerrostalo yksiöt",
          "2": "Kerrostalo kaksiot",
          "3": "Kerrostalo kolmiot+",
          "5": "Rivitalot yhteensä",
        },
      },
    },
    contentscode: { category: { index: { keskihinta_aritm_nw: 0, lkm_julk20: 1 } } },
  },
};

afterEach(() => vi.restoreAllMocks());

describe("hae_asuntojen_hinnat", () => {
  it("näyttää neliöhinnat ja kauppamäärät talotyypeittäin", async () => {
    const fetchMock = stubFetchOnce(jsonResponse(data));
    const res = await haeAsuntojenHinnat({ postinumero: "00100" });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1] && (fetchMock.mock.calls[0]![1] as RequestInit).body));
    expect(body.query[0].selection.values).toEqual(["00100"]);
    expect(body.query[1].selection).toEqual({ filter: "top", values: ["1"] });

    const t = res.content[0]!.text;
    expect(t).toContain("Helsinki keskusta - Etu-Töölö");
    expect(t).toContain("Vuosi: 2025");
    expect(t).toContain("Kerrostalo yksiöt");
    expect(t).toMatch(/7\s?371 €/);
    expect(t).toMatch(/136/);
    // rivitalot null -> ei riviä
    expect(t).not.toContain("Rivitalot yhteensä");
  });

  it("annettu vuosi -> item-valinta", async () => {
    const fetchMock = stubFetchOnce(jsonResponse(data));
    await haeAsuntojenHinnat({ postinumero: "00100", vuosi: 2020 });
    const body = JSON.parse(String((fetchMock.mock.calls[0]![1] as RequestInit).body));
    expect(body.query[1].selection).toEqual({ filter: "item", values: ["2020"] });
  });

  it("tuntematon postinumero (400) -> tietosuojaviesti", async () => {
    stubFetchOnce(jsonResponse({}, 400));
    const res = await haeAsuntojenHinnat({ postinumero: "99999" });
    expect(res.content[0]!.text).toMatch(/Ei julkaistuja asuntohintoja/i);
  });

  it("HTTP 500 -> ei heitä", async () => {
    stubFetchOnce(jsonResponse({}, 500));
    const res = await haeAsuntojenHinnat({ postinumero: "00100" });
    expect(res.content[0]!.text).toMatch(/epäonnistui|HTTP 500/i);
  });
});
