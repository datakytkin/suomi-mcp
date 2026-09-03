#!/usr/bin/env node
/**
 * Datasilta – keskitetty MCP Gateway.
 *
 * Yksi julkinen päätepiste + token, jonka asiakas liittää suoraan Claude
 * Desktopiin tai Grokin Custom Connectors -kenttään. Ei paikallista asennusta.
 *
 * Kuljetukset:
 *   1. HTTP + SSE (deprecoitu MCP-spec:ssä, mutta laajimmin tuettu connector-UI:ssa)
 *        GET  /sse?token=...             avaa SSE-striimin, session-kohtainen MCP-server
 *        POST /messages?sessionId=...    client lähettää JSON-RPC-viestit tänne
 *   2. Streamable HTTP (spec-nykyinen, suositeltu)
 *        POST|GET|DELETE /mcp            stateless: uusi instanssi per pyyntö
 *
 *   GET /healthz   – tila + työkalulista
 *   GET /          – lyhyt käyttöohje
 *
 * Kovennukset: request-id + lokitus, plan-kohtainen rate limit, rinnakkaisten
 * SSE-sessioiden katto per asiakas, graceful shutdown (SIGTERM/SIGINT).
 *
 * Ajo:  npm run dev:gateway     (tsx watch)
 *       PORT=3000 npm run start:gateway
 */

import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";

import cors from "cors";
import express, { type Request, type Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { validateToken } from "./auth.js";
import { createMcpServer, SERVER_NAME, SERVER_VERSION } from "./mcp-server.js";
import { consume, limitsFor } from "./rate-limit.js";
import { loadTools } from "./tools/registry.js";
import type { Principal } from "./tools/types.js";

const PORT = Number(process.env.PORT ?? 3000);

// Työkalut ladataan kerran; jokainen sessio saa oman MCP-serverinstanssin.
const tools = await loadTools();
const toolNames = tools.map((t) => t.name);

const app = express();

interface SseSession {
  transport: SSEServerTransport;
  customerId: string;
  plan: string;
}

/** Avoimet SSE-sessiot: sessionId -> sessio (POST /messages reititys + rate limit). */
const sseSessions = new Map<string, SseSession>();

function sessionCountFor(customerId: string): number {
  let n = 0;
  for (const s of sseSessions.values()) if (s.customerId === customerId) n++;
  return n;
}

/* -------------------------------------------------------------------------- */
/* Middlewaret                                                                */
/* -------------------------------------------------------------------------- */

// CORS – täysin auki (ngrok + Grok/Claude -testausta varten).
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
    exposedHeaders: ["Mcp-Session-Id", "X-Request-Id"],
  }),
);

app.use(express.json({ limit: "4mb" }));

// Request-id + kevyt pyyntöloki (ohita /healthz-melu).
app.use((req: Request & { reqId?: string }, res, next) => {
  const id = randomUUID().slice(0, 8);
  req.reqId = id;
  res.setHeader("X-Request-Id", id);
  const started = Date.now();
  res.on("finish", () => {
    if (req.path === "/healthz") return;
    log(`${id} ${req.method} ${req.path} ${res.statusCode} ${Date.now() - started}ms`);
  });
  next();
});

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

/**
 * Kuluta yksi rate-limit-token. Asettaa RateLimit-otsakkeet. Jos yli rajan,
 * vastaa 429:llä ja palauttaa false (kutsuja lopettaa käsittelyn).
 */
function enforceRate(
  res: Response,
  customerId: string,
  plan: string,
  jsonRpc = false,
): boolean {
  const r = consume(customerId, plan);
  res.setHeader("RateLimit-Limit", String(r.limit));
  res.setHeader("RateLimit-Remaining", String(r.remaining));
  if (r.allowed) return true;

  res.setHeader("Retry-After", String(r.retryAfterSec));
  if (jsonRpc) {
    res.status(429).json({
      jsonrpc: "2.0",
      error: {
        code: -32029,
        message: `rate_limited: yritä ${r.retryAfterSec} s kuluttua`,
      },
      id: null,
    });
  } else {
    res.status(429).json({
      error: "rate_limited",
      retryAfterSec: r.retryAfterSec,
    });
  }
  return false;
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
    sseSessions: sseSessions.size,
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

  const { maxConcurrentSessions } = limitsFor(principal.plan);
  if (sessionCountFor(principal.customerId) >= maxConcurrentSessions) {
    res.status(429).json({
      error: "too_many_sessions",
      maxConcurrentSessions,
    });
    return;
  }

  const transport = new SSEServerTransport("/messages", res);
  sseSessions.set(transport.sessionId, {
    transport,
    customerId: principal.customerId,
    plan: principal.plan,
  });
  log(
    `sse open   session=${transport.sessionId} customer=${principal.customerId} plan=${principal.plan} (${sseSessions.size} auki)`,
  );

  const cleanup = () => {
    if (sseSessions.delete(transport.sessionId)) {
      log(`sse close  session=${transport.sessionId} (${sseSessions.size} auki)`);
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
  const session = sseSessions.get(sessionId);
  if (!session) {
    res.status(404).json({ error: "unknown_session" });
    return;
  }
  if (!enforceRate(res, session.customerId, session.plan)) return;

  await session.transport.handlePostMessage(req, res, req.body);
});

/* -------------------------------------------------------------------------- */
/* Kuljetus 2: Streamable HTTP (stateless)                                     */
/* -------------------------------------------------------------------------- */

app.all("/mcp", async (req, res) => {
  const principal: Principal | null = validateToken(readToken(req));
  if (!principal) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "invalid_token" },
      id: null,
    });
    return;
  }
  if (!enforceRate(res, principal.customerId, principal.plan, true)) return;

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
/* Käynnistys + graceful shutdown                                             */
/* -------------------------------------------------------------------------- */

const httpServer: HttpServer = app.listen(PORT, () => {
  log(`${SERVER_NAME}@${SERVER_VERSION}  http://localhost:${PORT}`);
  log(`  SSE:             GET  http://localhost:${PORT}/sse?token=demo`);
  log(`  Streamable HTTP: POST http://localhost:${PORT}/mcp   (Bearer demo)`);
  log(`  Työkalut (${toolNames.length}): ${toolNames.join(", ") || "(ei yhtään)"}`);
  if (process.env.DATASILTA_DEV_ALLOW_ANY === "1") {
    log("  DEV: mikä tahansa ≥3 merkin token kelpaa (DATASILTA_DEV_ALLOW_ANY=1)");
  }
});

let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`${signal} – suljetaan (${sseSessions.size} SSE-sessiota)`);

  httpServer.close(() => log("http-palvelin suljettu"));
  for (const { transport } of sseSessions.values()) {
    void transport.close();
  }
  sseSessions.clear();

  // Varmuusraja: pakota ulos jos jokin yhteys ei sulkeudu.
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
