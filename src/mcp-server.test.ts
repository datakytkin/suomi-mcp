import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import { beforeEach, describe, expect, it } from "vitest";

import { createMcpServer } from "./mcp-server.js";
import type { ToolContext, ToolDefinition } from "./tools/types.js";

const ctx: ToolContext = { principal: null, transport: "stdio" };

const okTool: ToolDefinition = {
  name: "kaiku",
  title: "Kaiku",
  description: "Palauttaa annetun tekstin sellaisenaan – testityökalu.",
  inputSchema: { teksti: z.string() },
  handler: (args) => ({
    content: [{ type: "text", text: `kaiku: ${(args as { teksti: string }).teksti}` }],
  }),
};

const boomTool: ToolDefinition = {
  name: "rikki",
  title: "Rikki",
  description: "Heittää poikkeuksen aina – virheenkäsittelyn testi.",
  inputSchema: {},
  handler: () => {
    throw new Error("hajosi");
  },
};

async function connect(tools: ToolDefinition[]) {
  const server = createMcpServer(tools, ctx);
  const client = new Client({ name: "test", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

describe("createMcpServer", () => {
  let client: Client;
  beforeEach(async () => {
    client = await connect([okTool, boomTool]);
  });

  it("rekisteröi kaikki työkalut tools/list-vastaukseen", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["kaiku", "rikki"]);
  });

  it("liittää oletusannotaatiot (read-only, open-world)", async () => {
    const { tools } = await client.listTools();
    const kaiku = tools.find((t) => t.name === "kaiku");
    expect(kaiku?.annotations).toMatchObject({
      readOnlyHint: true,
      openWorldHint: true,
    });
  });

  it("ajaa työkalun ja palauttaa tekstin", async () => {
    const res = await client.callTool({ name: "kaiku", arguments: { teksti: "hei" } });
    expect((res.content as { text: string }[])[0]!.text).toBe("kaiku: hei");
  });

  it("käärii heitetyn poikkeuksen isError-vastaukseksi (ei kaada palvelinta)", async () => {
    const res = await client.callTool({ name: "rikki", arguments: {} });
    expect(res.isError).toBe(true);
    expect((res.content as { text: string }[])[0]!.text).toMatch(/hajosi/);
  });
});
