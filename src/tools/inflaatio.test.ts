import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, stubFetchOnce } from "../test-utils.js";
import { _resetSarjaCache, laskeInflaatio } from "./inflaatio.js";

/** json-stat2 -muotoinen indeksisarja annetuista [vuosi, pisteluku] -pareista. */
function series(rows: [string, number | null][]) {
  const index: Record<string, number> = {};
  const value: (number | null)[] = [];
  rows.forEach(([y, v], i) => {
    index[y] = i;
    value.push(v);
  });
  return {
    value,
    dimension: { timeperiod_y: { category: { index } } },
  };
}

// Elinkustannusindeksin kaltaiset arvot (1951:10=100).
const EKI = series([
  ["1985", 980],
  ["2000", 1501],
  ["2015", 1906],
  ["2024", 2332],
  ["2025", 2339],
]);

beforeEach(() => _resetSarjaCache());
afterEach(() => vi.restoreAllMocks());

describe("laske_inflaatio", () => {
  it("laskee ostovoiman muutoksen ja muutosprosentin", async () => {
    stubFetchOnce(jsonResponse(EKI));
    const res = await laskeInflaatio({ summa: 1000, vuosi_alku: 2000, vuosi_loppu: 2025 });
    const text = res.content[0]!.text;
    expect(text).toContain("vuonna 2000");
    expect(text).toContain("2025");
    expect(text).toMatch(/1\s?558/); // 1000 * 2339/1501 ≈ 1558
    expect(text).toContain("nousseet");
    expect(text).toContain("55,8 %");
    expect(text).toContain("1951:10=100");
  });

  it("ilman vuosi_loppua käyttää viimeisintä vuotta", async () => {
    stubFetchOnce(jsonResponse(EKI));
    const res = await laskeInflaatio({ summa: 100, vuosi_alku: 1985 });
    expect(res.content[0]!.text).toContain("vuonna 2025");
  });

  it("tuntematon vuosi -> selkeä viesti saatavilla olevasta välistä", async () => {
    stubFetchOnce(jsonResponse(EKI));
    const res = await laskeInflaatio({ summa: 100, vuosi_alku: 1960 });
    expect(res.content[0]!.text).toMatch(/ei ole .*indeksiä.*1985–2025/s);
  });

  it("HTTP-virhe -> ei heitä", async () => {
    stubFetchOnce(jsonResponse({}, 503));
    const res = await laskeInflaatio({ summa: 100, vuosi_alku: 2015 });
    expect(res.content[0]!.text).toMatch(/epäonnistui|HTTP 503/i);
  });
});
