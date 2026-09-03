#!/usr/bin/env node
/**
 * Datasilta – keskitetty MCP Gateway.
 *
 * Yksi julkinen päätepiste + token, jonka asiakas liittää suoraan Claude
 * Desktopiin tai Grokin Custom Connectors -kenttään. Ei paikallista asennusta.
 *
 * Kuljetukset:
 *   1. HTTP + SSE (deprecoitu MCP-spec:ssä, mutta laajimmin tuettu connector-UI:ssa)
 *        GET  /sse?token=...     avaa SSE-striimin, luo session-kohtaisen MCP-serverin
 *        POST /messages?sessionId=...   client lähettää JSON-RPC-viestit tänne
 *   2. Streamable HTTP (spec-nykyinen, suositeltu)
 *        POST|GET|DELETE /mcp    stateless: uusi instanssi per pyyntö
 *
 *   GET /healthz   – tila + työkalulista
 *   GET /          – lyhyt käyttöohje
 *
 * Ajo:  npm run dev:gateway     (tsx watch)
 *       PORT=3000 npm run start:gateway
 */

import cors from "cors";
import express, { type Request } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { validateToken } from "./auth.js";
import { createMcpServer, SERVER_NAME, SERVER_VERSION } from "./mcp-server.js";
import { loadTools } from "./tools/registry.js";

const PORT = Number(process.env.PORT ?? 3000);

// Työkalut ladataan kerran; jokainen sessio saa oman MCP-serverinstanssin.
const tools = await loadTools();
const toolNames = tools.map((t) => t.name);

const app = express();

/** Avoimet SSE-sessiot: sessionId -> transport (POST /messages reititys). */
const sseTransports = new Map<string, SSEServerTransport>();

/* -------------------------------------------------------------------------- */
/* CORS – täysin auki (ngrok + Grok/Claude -testausta varten)                 */
/* -------------------------------------------------------------------------- */

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Mcp-Session-Id",
      "Mcp-Protocol-Version",
      "Last-Event-ID",
    ],
    exposedHeaders: ["Mcp-Session-Id"],
  }),
);

app.use(express.json({ limit: "4mb" }));

/* -------------------------------------------------------------------------- */
/* Apurit                                                                     */
/* -------------------------------------------------------------------------- */

/** Token joko ?token= -parametrista tai Authorization: Bearer -otsakkeesta. */
function readToken(req: Request): string | undefined {
  const q = req.query.token;
  if (typeof q === "string" && q.length > 0) return q;
  const header = req.header("authorization");
  if (header && header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return undefined;
}

function log(...args: unknown[]) {
  console.error(`[${new Date().toISOString()}]`, ...args);
}

/* -------------------------------------------------------------------------- */
/* Tila & ohje                                                                */
/* -------------------------------------------------------------------------- */

app.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    server: `${SERVER_NAME}@${SERVER_VERSION}`,
    transports: ["sse", "streamable-http"],
    tools: toolNames,
    sseSessions: sseTransports.size,
  });
});

app.get("/", (_req, res) => {
  res
    .type("text/plain")
    .send(
      [
        `Datasilta MCP Gateway (${SERVER_NAME}@${SERVER_VERSION})`,
        "",
        "SSE:             GET  /sse?token=YOUR_TOKEN",
        "Streamable HTTP: POST /mcp   (Authorization: Bearer YOUR_TOKEN  tai ?token=)",
        "Tila:            GET  /healthz",
        "",
        `Työkalut: ${toolNames.join(", ") || "(ei yhtään)"}`,
      ].join("\n"),
    );
});

/* -------------------------------------------------------------------------- */
/* Kuljetus 1: HTTP + SSE                                                      */
/* -------------------------------------------------------------------------- */

app.get("/sse", async (req, res) => {
  const principal = validateToken(readToken(req));
  if (!principal) {
    res.status(401).json({ error: "invalid_token" });
    return;
  }

  const transport = new SSEServerTransport("/messages", res);
  sseTransports.set(transport.sessionId, transport);
  log(
    `sse open   session=${transport.sessionId} customer=${principal.customerId} plan=${principal.plan}`,
  );

  const cleanup = () => {
    if (sseTransports.delete(transport.sessionId)) {
      log(`sse close  session=${transport.sessionId}`);
    }
  };
  transport.onclose = cleanup;
  res.on("close", cleanup);

  const server = createMcpServer(tools, { principal, transport: "sse" });
  try {
    await server.connect(transport); // kutsuu transport.start()
  } catch (err) {
    log("sse connect error", err);
    cleanup();
  }
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  if (typeof sessionId !== "string") {
    res.status(400).json({ error: "missing_sessionId" });
    return;
  }
  const transport = sseTransports.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: "unknown_session" });
    return;
  }
  await transport.handlePostMessage(req, res, req.body);
});

/* -------------------------------------------------------------------------- */
/* Kuljetus 2: Streamable HTTP (stateless)                                     */
/* -------------------------------------------------------------------------- */

app.all("/mcp", async (req, res) => {
  const principal = validateToken(readToken(req));
  if (!principal) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "invalid_token" },
      id: null,
    });
    return;
  }

  const server = createMcpServer(tools, { principal, transport: "http" });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless: ei session-tilaa palvelimella
  });

  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    log("mcp request error", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "internal_error" },
        id: null,
      });
    }
  }
});

/* -------------------------------------------------------------------------- */

app.listen(PORT, () => {
  log(`${SERVER_NAME}@${SERVER_VERSION}  http://localhost:${PORT}`);
  log(`  SSE:             GET  http://localhost:${PORT}/sse?token=demo`);
  log(`  Streamable HTTP: POST http://localhost:${PORT}/mcp   (Bearer demo)`);
  log(`  Työkalut (${toolNames.length}): ${toolNames.join(", ") || "(ei yhtään)"}`);
  if (process.env.DATASILTA_DEV_ALLOW_ANY === "1") {
    log("  DEV: mikä tahansa ≥3 merkin token kelpaa (DATASILTA_DEV_ALLOW_ANY=1)");
  }
});
