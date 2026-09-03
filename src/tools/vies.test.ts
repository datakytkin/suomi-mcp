import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, stubFetchOnce } from "../test-utils.js";
import { tarkistaAlvTunnus } from "./vies.js";

afterEach(() => vi.restoreAllMocks());

describe("tarkista_alv_tunnus", () => {
  it("voimassa oleva tunnus -> nimi + osoite", async () => {
    const fetchMock = stubFetchOnce(
      jsonResponse({
        isValid: true,
        userError: "VALID",
        name: "Kesko Oyj",
        address: "PL 1\n00016 KESKO",
        vatNumber: "01098628",
        requestDate: "2026-09-03T18:00:00.000Z",
      }),
    );

    const res = await tarkistaAlvTunnus({ alv_tunnus: "FI01098628" });

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/ms/FI/vat/01098628");
    const text = res.content[0]!.text;
    expect(text).toContain("FI01098628: VOIMASSA");
    expect(text).toContain("Kesko Oyj");
    expect(text).toContain("PL 1, 00016 KESKO");
  });

  it("suomalainen Y-tunnus normalisoidaan FI-tunnukseksi", async () => {
    const fetchMock = stubFetchOnce(jsonResponse({ isValid: true, name: "X", address: "" }));
    await tarkistaAlvTunnus({ alv_tunnus: "0109862-8" });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/ms/FI/vat/01098628");
  });

  it("virheellinen tunnus -> EI VOIMASSA + VIES-syy", async () => {
    stubFetchOnce(jsonResponse({ isValid: false, userError: "INVALID" }));
    const res = await tarkistaAlvTunnus({ alv_tunnus: "FI00000000" });
    expect(res.content[0]!.text).toContain("EI VOIMASSA");
    expect(res.content[0]!.text).toContain("INVALID");
  });

  it("EU:n ulkopuolinen maakoodi -> ei kutsuta VIES:iä", async () => {
    const fetchMock = stubFetchOnce(jsonResponse({}));
    const res = await tarkistaAlvTunnus({ alv_tunnus: "US123456789" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.content[0]!.text).toMatch(/ei ole EU:n ALV-alueella/i);
  });

  it("HTTP-virhe -> ei heitä", async () => {
    stubFetchOnce(jsonResponse({}, 500));
    const res = await tarkistaAlvTunnus({ alv_tunnus: "FI01098628" });
    expect(res.content[0]!.text).toMatch(/epäonnistui|HTTP 500/i);
  });
});
