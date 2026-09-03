#!/usr/bin/env node
/**
 * datakytkin-mcp – paikallinen stdio-MCP-palvelin.
 *
 * Tämä on OSS-jakelun entry (npm: `datakytkin-mcp`). Se käyttää samaa
 * työkalurekisteriä kuin Datasilta-Gateway (`src/gateway.ts`), joten työkalut
 * määritellään vain kerran kansiossa `src/tools/`.
 *
 *   npx tsx src/index.ts          (kehitys)
 *   npm run build && npm start    (käännetty)
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createMcpServer } from "./mcp-server.js";
import { loadTools } from "./tools/registry.js";

async function main() {
  const tools = await loadTools();
  const server = createMcpServer(tools, { principal: null, transport: "stdio" });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // stdout on varattu MCP-protokollalle -> lokitus stderriin.
  console.error(
    `datakytkin-mcp (stdio) käynnissä. Työkalut: ${
      tools.map((t) => t.name).join(", ") || "(ei yhtään)"
    }`,
  );
}

main().catch((err) => {
  console.error("datakytkin-mcp: kohtalokas virhe käynnistyksessä:", err);
  process.exit(1);
});
