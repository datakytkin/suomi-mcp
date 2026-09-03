/**
 * Rakentaa yhden MCP-palvelininstanssin annetuilla työkaluilla ja kontekstilla.
 *
 * Gateway kutsuu tätä kerran per sessio/pyyntö, stdio-entry kerran per prosessi.
 * Käytetään `McpServer`-luokkaa (virallisen SDK:n ergonominen kääre `Server`-
 * luokalle), koska työkalut on määritelty zod raw shape -skeemoilla.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ToolContext, ToolDefinition } from "./tools/types.js";

export const SERVER_NAME = "datasilta-gateway";
export const SERVER_VERSION = "0.3.0";

export function createMcpServer(
  tools: ToolDefinition[],
  ctx: ToolContext,
): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations ?? {
          readOnlyHint: true,
          openWorldHint: true,
          idempotentHint: true,
        },
      },
      async (args: Record<string, unknown>) => {
        try {
          return await tool.handler(args, ctx);
        } catch (err) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Työkalu "${tool.name}" epäonnistui: ${
                  (err as Error).message
                }`,
              },
            ],
          };
        }
      },
    );
  }

  return server;
}
