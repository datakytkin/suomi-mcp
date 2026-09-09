import { describe, expect, it } from "vitest";

import { tarkistaIban } from "./iban.js";

describe("tarkista_iban", () => {
  it("kelvollinen suomalainen IBAN -> mod-97 OK + kansallinen tilinumero + pankki", () => {
    const res = tarkistaIban({ iban: "FI21 1234 5600 0007 85" });
    const t = res.content[0]!.text;
    expect(t).toContain("kelvollinen (mod-97 OK)");
    expect(t).toContain("Maa: FI");
    expect(t).toContain("Kansallinen tilinumero:");
    expect(t).toContain("Pankki (arvio): Nordea"); // 12xxxx -> Nordea
    expect(t).toContain("FI21 1234 5600 0007 85"); // ryhmitelty
  });

  it("kelvollinen ei-suomalainen IBAN (DE) -> OK, ei kansallista tilinumeroa", () => {
    const res = tarkistaIban({ iban: "DE89 3704 0044 0532 0130 00" });
    const t = res.content[0]!.text;
    expect(t).toContain("kelvollinen (mod-97 OK)");
    expect(t).toContain("Maa: DE");
    expect(t).not.toContain("Kansallinen tilinumero");
  });

  it("virheellinen tarkistusnumero -> EI LÄPÄISSYT", () => {
    const res = tarkistaIban({ iban: "FI2112345600000786" });
    expect(res.content[0]!.text).toContain("EI LÄPÄISSYT");
  });

  it("väärä pituus (FI) -> ei läpäise", () => {
    const res = tarkistaIban({ iban: "FI211234560000078" });
    expect(res.content[0]!.text).toMatch(/väärä pituus|EI LÄPÄISSYT/i);
  });

  it("ei IBAN-muotoa -> selkeä viesti", () => {
    const res = tarkistaIban({ iban: "123456-789" });
    expect(res.content[0]!.text).toMatch(/ei ole IBAN-muotoa/i);
  });
});
