import { afterEach, describe, expect, it, vi } from "vitest";

import { textResponse } from "../test-utils.js";
import { haeSaa } from "./saa.js";

function member(time: string, name: string, value: string) {
  return `<wfs:member><BsWfs:BsWfsElement>
    <BsWfs:Time>${time}</BsWfs:Time>
    <BsWfs:ParameterName>${name}</BsWfs:ParameterName>
    <BsWfs:ParameterValue>${value}</BsWfs:ParameterValue>
  </BsWfs:BsWfsElement></wfs:member>`;
}

function forecastXml(hours: number) {
  const base = new Date();
  base.setMinutes(0, 0, 0);
  const parts: string[] = ['<?xml version="1.0"?><wfs:FeatureCollection>'];
  for (let h = 0; h < hours; h++) {
    const t = new Date(base.getTime() + h * 3_600_000).toISOString().replace(/\.\d+Z$/, "Z");
    parts.push(
      member(t, "Temperature", String(10 + h)),
      member(t, "WindSpeedMS", "4.2"),
      member(t, "PrecipitationAmount", h === 1 ? "0.5" : "0.0"),
      member(t, "Humidity", "72"),
    );
  }
  parts.push("</wfs:FeatureCollection>");
  return parts.join("\n");
}

function stubText(text: string, status = 200) {
  const m = vi.fn(async () => textResponse(text, status));
  vi.stubGlobal("fetch", m);
  return m;
}

afterEach(() => vi.restoreAllMocks());

describe("hae_saa", () => {
  it("jäsentää ennusteen ja rajaa tunnit-parametrilla", async () => {
    const fetchMock = stubText(forecastXml(24));
    const res = await haeSaa({ paikkakunta: "Helsinki", tunnit: 6 });

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("place=Helsinki");
    expect(url).toContain("storedquery_id=fmi");

    const text = res.content[0]!.text;
    expect(text).toContain("Helsinki");
    expect(text).toContain("Seuraavat 6 h");
    expect(text).toContain("°C");
    expect(text).toContain("m/s");
    expect(text).toMatch(/sadetta yhteensä 0,5 mm/);
  });

  it("tuntematon paikkakunta (ExceptionReport) -> ohjeistava viesti", async () => {
    stubText(
      '<?xml version="1.0"?><ExceptionReport><Exception><ExceptionText>No locations found for the place</ExceptionText></Exception></ExceptionReport>',
      400,
    );
    const res = await haeSaa({ paikkakunta: "Atlantis" });
    expect(res.content[0]!.text).toMatch(/ei tunnistettu/i);
    expect(res.content[0]!.text).toContain("No locations found");
  });

  it("tyhjä XML -> selkeä viesti", async () => {
    stubText('<?xml version="1.0"?><wfs:FeatureCollection></wfs:FeatureCollection>');
    const res = await haeSaa({ paikkakunta: "Helsinki" });
    expect(res.content[0]!.text).toMatch(/ei saatu/i);
  });
});
