#!/usr/bin/env node
/**
 * Datakytkin MCP -palvelin (stdio)
 *
 * Tuo Clauden käyttöön suomalaisia avoimen datan rajapintoja:
 *   1. hae_yritystiedot_prh               – PRH / YTJ yrityshaku
 *   2. hae_julkiset_hankinnat_hilma       – Hilma julkiset hankinnat
 *   3. hae_kaupparekisteri_muutokset_prh  – PRH rekisteröidyt ilmoitukset
 *
 * Ajo paikallisesti:  npx tsx src/index.ts
 * Käännettynä:        npm run build && node dist/index.js
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  haeYritystiedotPrh,
  haeYritystiedotPrhInputSchema,
} from "./tools/prh.js";
import {
  haeJulkisetHankinnatHilma,
  haeJulkisetHankinnatHilmaInputSchema,
} from "./tools/hilma.js";
import {
  haeKaupparekisteriMuutoksetPrh,
  haeKaupparekisteriMuutoksetPrhInputSchema,
} from "./tools/kaupparekisteri.js";

const server = new McpServer({
  name: "datakytkin-mcp",
  version: "0.2.0",
});

/* -------------------------------------------------------------------------- */
/* Työkalu 1: PRH / YTJ yrityshaku                                            */
/* -------------------------------------------------------------------------- */

server.registerTool(
  "hae_yritystiedot_prh",
  {
    title: "Hae yritystiedot (PRH / YTJ)",
    description:
      "Hakee suomalaisen yrityksen perustiedot PRH:n avoimesta YTJ-rajapinnasta. " +
      "Anna joko Y-tunnus (1234567-8) tai yrityksen nimi. Palauttaa nimen, Y-tunnuksen, " +
      "yritysmuodon, rekisteröintipäivän ja toiminnan tilan.",
    inputSchema: haeYritystiedotPrhInputSchema,
  },
  async (args) => haeYritystiedotPrh(args),
);

/* -------------------------------------------------------------------------- */
/* Työkalu 2: Hilma julkiset hankinnat                                        */
/* -------------------------------------------------------------------------- */

server.registerTool(
  "hae_julkiset_hankinnat_hilma",
  {
    title: "Hae julkiset hankinnat (Hilma)",
    description:
      "Hakee julkisia hankintailmoituksia Hilmasta (hankintailmoitukset.fi) hakusanalla. " +
      "Palauttaa ilmoituksen otsikon, hankintayksikön, tarjousten määräajan ja suorat linkit " +
      "ilmoitukseen ja tarjouspyyntöasiakirjoihin. Oletuksena vain avoinna olevat ilmoitukset.",
    inputSchema: haeJulkisetHankinnatHilmaInputSchema,
  },
  async (args) => haeJulkisetHankinnatHilma(args),
);

/* -------------------------------------------------------------------------- */
/* Työkalu 3: PRH rekisteröidyt ilmoitukset (kaupparekisterin muutokset)      */
/* -------------------------------------------------------------------------- */

server.registerTool(
  "hae_kaupparekisteri_muutokset_prh",
  {
    title: "Hae kaupparekisterin muutokset (PRH)",
    description:
      "Hakee yrityksen perustiedot ja aikajanan kaupparekisteriin rekisteröidyistä " +
      "ilmoituksista PRH:n avoimesta rajapinnasta: hallitus- ja nimenmuutokset, " +
      "tilinpäätökset, osakepääoman muutokset, konkurssi/saneeraus/selvitystila jne. " +
      "Anna Y-tunnus (1234567-8) tai yrityksen nimi. Täysi kattavuus kaikkiin " +
      "kaupparekisteriyrityksiin.",
    inputSchema: haeKaupparekisteriMuutoksetPrhInputSchema,
  },
  async (args) => haeKaupparekisteriMuutoksetPrh(args),
);

/* -------------------------------------------------------------------------- */
/* Käynnistys                                                                 */
/* -------------------------------------------------------------------------- */

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout on varattu MCP-protokollalle -> lokitus stderriin.
  console.error(
    "datakytkin-mcp käynnissä (stdio). Työkalut: hae_yritystiedot_prh, " +
      "hae_julkiset_hankinnat_hilma, hae_kaupparekisteri_muutokset_prh",
  );
}

main().catch((err) => {
  console.error("datakytkin-mcp: kohtalokas virhe käynnistyksessä:", err);
  process.exit(1);
});
