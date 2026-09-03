/**
 * Yhteiset tyypit työkaluille ja Gatewaylle.
 *
 * Jokainen työkalumoduuli kansiossa `src/tools/` vie yhden tai useamman
 * `ToolDefinition`-olion. `registry.ts` löytää ne automaattisesti – uuden
 * työkalun lisääminen = pudota tiedosto tähän kansioon.
 */

import type { ZodRawShape } from "zod";

/** Tokenin takana oleva asiakas (mock-auth palauttaa tämän). */
export interface Principal {
  customerId: string;
  plan: "free" | "pro" | "enterprise";
  token: string;
}

/** Työkalukutsun konteksti. `principal` on null paikallisessa stdio-ajossa. */
export interface ToolContext {
  principal: Principal | null;
  transport: "stdio" | "sse" | "http";
}

/**
 * MCP-työkalun tekstivastaus. Rakenteellisesti yhteensopiva SDK:n
 * `CallToolResult`-tyypin kanssa (siksi index signature).
 */
export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
  [key: string]: unknown;
}

export interface ToolDefinition<Args = Record<string, unknown>> {
  /** MCP-työkalun nimi, esim. "hae_yritystiedot_prh". */
  name: string;
  /** Lyhyt otsikko UI:ta varten. */
  title: string;
  /** Kuvaus jonka tekoäly näkee – kerro mitä tekee ja mitä parametreja odottaa. */
  description: string;
  /** Zod raw shape: olio jonka arvot ovat zod-skeemoja. */
  inputSchema: ZodRawShape;
  /** Varsinainen toteutus. `ctx` on käytettävissä esim. asiakas­kohtaiseen rajaukseen. */
  handler: (args: Args, ctx: ToolContext) => Promise<ToolResult> | ToolResult;
}
