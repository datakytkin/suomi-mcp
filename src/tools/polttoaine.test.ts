import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, stubFetchOnce } from "../test-utils.js";
import { haePolttoaineenHinnat } from "./polttoaine.js";

// dims [timeperiod_m=3, coicop=4, content=1]; row-major month*4 + fuel
const data = {
  value: [
    // 2026M06
    1.7, 2.15, 1.99, 2.09,
    // 2026M07
    1.75, 2.2, 2.04, 2.14,
    // 2026M08 (viimeisin)
    1.78, 2.25, 2.09, 2.19,
  ],
  dimension: {
    timeperiod_m: { category: { index: { "2026M06": 0, "2026M07": 1, "2026M08": 2 } } },
    coicop_13_20160512: {
      category: {
        index: { "0400500": 0, "0700100": 1, "0700200": 2, "0700300": 3 },
        label: {
          "0400500": "Kevyt polttoöljy, 1 l",
          "0700100": "Diesel, 1 l",
          "0700200": "Bensiini 95 E 10, 1 l",
          "0700300": "Bensiini 98 E 5, 1 l",
        },
      },
    },
  },
};

afterEach(() => vi.restoreAllMocks());

describe("hae_polttoaineen_hinnat", () => {
  it("näyttää viimeisimmän kuukauden hinnat ja muutokset", async () => {
    stubFetchOnce(jsonResponse(data));
    const res = await haePolttoaineenHinnat();
    const t = res.content[0]!.text;

    expect(t).toContain("08/2026");
    expect(t).toContain("Diesel");
    expect(t).toContain("2,25 €");
    expect(t).toContain("Bensiini 95 E 10");
    expect(t).toContain("2,09 €");
    // muutos vs. ed. kk: diesel 2.20 -> 2.25 = +2.3 %
    expect(t).toMatch(/\+2,3 %/);
    expect(t).toContain("ei reaaliaikainen pumppuhinta");
  });

  it("tyhjä data -> selkeä viesti", async () => {
    stubFetchOnce(jsonResponse({ value: [], dimension: {} }));
    const res = await haePolttoaineenHinnat();
    expect(res.content[0]!.text).toMatch(/ei ole juuri nyt saatavilla/i);
  });

  it("HTTP-virhe -> ei heitä", async () => {
    stubFetchOnce(jsonResponse({}, 503));
    const res = await haePolttoaineenHinnat();
    expect(res.content[0]!.text).toMatch(/epäonnistui|HTTP 503/i);
  });
});
