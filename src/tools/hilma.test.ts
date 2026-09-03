import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, stubFetchOnce } from "../test-utils.js";
import { haeJulkisetHankinnatHilma } from "./hilma.js";

const notice = {
  noticeId: 55901,
  procedureId: 36500,
  noticeNumber: "2026-055901",
  datePublished: "2026-09-01T03:05:08.93Z",
  deadline: "2026-10-05T09:00:00Z",
  expirationDate: "2026-10-05T09:00:00Z",
  titleFi: "IT-projektipäällikkö- ja asiantuntijapalvelujen hankinta",
  titleEn: "",
  organisationNameFi: "Verohallinto",
  organisationNameEn: "",
  cpvCodes: "72000000",
  procurementDocumentsUrl: "https://tarjouspalvelu.fi/vero?id=625737",
  isEuProcurement: true,
  isNationalProcurement: false,
};

afterEach(() => vi.restoreAllMocks());

describe("haeJulkisetHankinnat_hilma", () => {
  it("välittää hakusanan ja rajaa aktiivisiin ($filter deadline gt)", async () => {
    const fetchMock = stubFetchOnce(
      jsonResponse({ "@odata.count": 49, value: [notice] }),
    );

    const res = await haeJulkisetHankinnatHilma({
      hakusana: "IT-konsultointi",
      max_tulokset: 3,
    });

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("search=IT-konsultointi");
    expect(url).toContain("%24top=3");
    expect(url).toContain("deadline+gt");

    const text = res.content[0]!.text;
    expect(text).toContain("IT-projektipäällikkö");
    expect(text).toContain("Verohallinto");
    expect(text).toContain("hankintailmoitukset.fi/fi/public/procurement/36500/notice/55901");
    expect(text).toContain("tarjouspalvelu.fi/vero");
  });

  it("vain_aktiiviset=false -> ei deadline-filtteriä, järjestys datePublished desc", async () => {
    const fetchMock = stubFetchOnce(jsonResponse({ "@odata.count": 1, value: [notice] }));
    await haeJulkisetHankinnatHilma({ hakusana: "x", vain_aktiiviset: false });
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).not.toContain("deadline+gt");
    expect(url).toContain("datePublished+desc");
  });

  it("tyhjä tulos -> selkeä viesti", async () => {
    stubFetchOnce(jsonResponse({ "@odata.count": 0, value: [] }));
    const res = await haeJulkisetHankinnatHilma({ hakusana: "eiloydy" });
    expect(res.content[0]!.text).toMatch(/ei .*hankintailmoituksia/i);
  });
});
