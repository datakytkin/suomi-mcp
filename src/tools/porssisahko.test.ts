import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, stubFetchOnce } from "../test-utils.js";
import { haePorssisahko } from "./porssisahko.js";

/**
 * Rakentaa `prices`-taulukon (uusin ensin, kuten oikea API) annetuista
 * [ISO-alku, hinta] -pareista. endDate = alku + 1 h.
 */
function prices(rows: [string, number][]) {
  return {
    prices: rows.map(([startDate, price]) => ({
      price,
      startDate,
      endDate: new Date(new Date(startDate).getTime() + 3_600_000).toISOString(),
    })),
  };
}

afterEach(() => vi.restoreAllMocks());

describe("hae_porssisahko", () => {
  it("näyttää hinnan nyt, tulevat tunnit ja halvimman/kalleimman", async () => {
    const now = new Date();
    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);
    const iso = (h: number) =>
      new Date(hourStart.getTime() + h * 3_600_000).toISOString();

    stubFetchOnce(
      jsonResponse(
        prices([
          [iso(3), 2.0], // halvin, tulevaisuudessa
          [iso(2), 9.5], // kallein
          [iso(1), 6.0],
          [iso(0), 7.0], // sisältää "nyt"
          [iso(-1), 5.0], // menneisyys – ei listalle
        ]),
      ),
    );

    const res = await haePorssisahko({ tunnit: 12 });
    const text = res.content[0]!.text;

    expect(text).toContain("sis. ALV 25,5 %");
    expect(text).toContain("Hinta nyt");
    expect(text).toContain("7,00 c/kWh"); // nykyinen tunti
    expect(text).toContain("← halvin");
    expect(text).toContain("← kallein");
    expect(text).toMatch(/Halvin:.*2,00 c\/kWh/);
    expect(text).toMatch(/Kallein:.*9,50 c\/kWh/);
    // menneisyyden tuntia ei listata "Seuraavat tunnit" -osioon
    expect(text).not.toContain("5,00 c/kWh");
  });

  it("rajaa listan tunnit-parametrilla", async () => {
    const base = new Date();
    base.setMinutes(0, 0, 0);
    const iso = (h: number) =>
      new Date(base.getTime() + h * 3_600_000).toISOString();
    stubFetchOnce(
      jsonResponse(prices([0, 1, 2, 3, 4, 5].map((h) => [iso(h), h + 1]))),
    );

    const res = await haePorssisahko({ tunnit: 2 });
    expect(res.content[0]!.text).toContain("Seuraavat 2 tuntia:");
  });

  it("tyhjä aineisto -> selkeä viesti", async () => {
    stubFetchOnce(jsonResponse({ prices: [] }));
    const res = await haePorssisahko({});
    expect(res.content[0]!.text).toContain("ei ole juuri nyt saatavilla");
  });

  it("HTTP-virhe -> ei heitä", async () => {
    stubFetchOnce(jsonResponse({}, 503));
    const res = await haePorssisahko({});
    expect(res.content[0]!.text).toMatch(/epäonnistui|HTTP 503/i);
  });
});
