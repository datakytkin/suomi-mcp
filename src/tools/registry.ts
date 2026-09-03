/**
 * Työkalurekisteri: lataa automaattisesti kaikki tämän kansion työkalumoduulit.
 *
 * Uuden työkalun lisääminen:
 *   1. luo esim. `src/tools/porssisahko.ts`
 *   2. vie siitä `export const tool: ToolDefinition = { ... }`
 *      (tai `export const tools: ToolDefinition[] = [ ... ]`)
 *   3. valmista – rekisteri poimii sen sekä stdio-palvelimeen että Gatewayhin.
 *
 * Toimii sekä `tsx`-ajossa (.ts) että käännettynä (dist/*.js).
 */

import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { ToolDefinition } from "./types.js";

const IGNORE = new Set(["registry", "types"]);

function isToolDefinition(v: unknown): v is ToolDefinition {
  if (!v || typeof v !== "object") return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.name === "string" &&
    typeof t.title === "string" &&
    typeof t.description === "string" &&
    typeof t.inputSchema === "object" &&
    t.inputSchema !== null &&
    typeof t.handler === "function"
  );
}

/** Löydä ja lataa kaikki työkalut. Nimien törmäys = virhe. */
export async function loadTools(): Promise<ToolDefinition[]> {
  const selfPath = fileURLToPath(import.meta.url);
  const dir = dirname(selfPath);
  const ext = selfPath.slice(selfPath.lastIndexOf(".")); // ".ts" tai ".js"

  const byName = new Map<string, ToolDefinition>();

  for (const file of readdirSync(dir)) {
    if (!file.endsWith(ext) || file.endsWith(`.d${ext}`)) continue;
    // Ohita testit ja apurit – ne eivät ole työkalumoduuleja eivätkä saa
    // latautua ajossa (esim. *.test.ts importtaa "vitest").
    if (file.endsWith(`.test${ext}`) || file.endsWith(`.spec${ext}`)) continue;
    const base = file.slice(0, -ext.length);
    if (IGNORE.has(base) || base.endsWith("-utils")) continue;

    const mod: Record<string, unknown> = await import(
      pathToFileURL(join(dir, file)).href
    );

    for (const value of Object.values(mod)) {
      const items = Array.isArray(value) ? value : [value];
      for (const item of items) {
        if (!isToolDefinition(item)) continue;
        if (byName.has(item.name)) {
          throw new Error(
            `Työkalun nimi "${item.name}" määritelty kahdesti (${file}).`,
          );
        }
        byName.set(item.name, item);
      }
    }
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
