import { describe, expect, it } from "vitest";

import { loadTools } from "./registry.js";

describe("loadTools", () => {
  it("löytää kaikki työkalut ilman duplikaatteja, aakkosjärjestyksessä", async () => {
    const names = (await loadTools()).map((t) => t.name);
    expect(names).toEqual([
      "hae_hankintailmoitus",
      "hae_julkiset_hankinnat_hilma",
      "hae_kaupparekisteri_muutokset_prh",
      "hae_porssisahko",
      "hae_saa",
      "hae_yritystiedot_prh",
      "laske_inflaatio",
      "tarkista_alv_tunnus",
    ]);
    expect(new Set(names).size).toBe(names.length);
  });

  it("jokaisella työkalulla on täydet kentät", async () => {
    for (const t of await loadTools()) {
      expect(t.name).toMatch(/^[a-z_]+$/);
      expect(typeof t.title).toBe("string");
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.inputSchema).toBeTypeOf("object");
      expect(t.handler).toBeTypeOf("function");
    }
  });
});
