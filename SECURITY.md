# Security policy

## Reporting a vulnerability

Please report security issues privately via
[GitHub Security Advisories](https://github.com/datakytkin/suomi-mcp/security/advisories/new)
(Security → Report a vulnerability). Do not open a public issue for anything
security-sensitive.

Expected response: acknowledgement within a few working days.

## Supported versions

Only the latest published `datakytkin-mcp` release on npm receives fixes.

## Scope and threat model

`datakytkin-mcp` is a local, read-only MCP server:

- It runs on the user's machine over stdio and is launched by the MCP client
  (e.g. Claude Desktop).
- It performs **only outbound HTTPS GET requests** to the public APIs listed
  below. It does not write anywhere, does not require credentials, stores no
  state, and sends no telemetry.
- Tool inputs are search terms (Business ID / name / keyword). They are
  URL-encoded into query parameters; no shell, filesystem or database access is
  involved.

The main practical risk is that a tool result contains attacker-influenced text
(e.g. a company name or procurement title chosen by a third party). As with any
MCP tool, treat tool output as untrusted content, not as instructions.

## Data sources and responsible use

| Tool | Endpoint | Status |
| --- | --- | --- |
| `hae_yritystiedot_prh` | `avoindata.prh.fi/opendata-ytj-api/v3` | Official PRH open data API, no key. CC BY 4.0. |
| `hae_kaupparekisteri_muutokset_prh` | `avoindata.prh.fi/opendata-registerednotices-api/v3` | Official PRH open data API, no key. CC BY 4.0. |
| `hae_julkiset_hankinnat_hilma` | `www.hankintailmoitukset.fi/search/eformnotices` | **Public search endpoint used by the Hilma website. Not a documented or officially supported API.** |

### About the Hilma endpoint

Hilma's officially supported machine interface is the **AVP read API**
(`api.hankintailmoitukset.fi`), which requires a free self-service subscription
key (`Ocp-Apim-Subscription-Key`). This project instead calls the keyless search
endpoint that powers the public site, so that the tool works with zero setup.

Because that endpoint is undocumented and unsupported:

- The server sends an identifying `User-Agent`
  (`datakytkin-mcp/<version> (+https://github.com/datakytkin/suomi-mcp)`).
- Every request has a 15 s timeout; there is no retry loop and no bulk crawling.
  Each tool call makes a single request for a small page of results.
- The endpoint may change or rate-limit without notice.

**For production, high-volume or commercial use, switch to the official AVP API
with your own subscription key.** If you maintain Hilma and want this project to
change its approach, please open an issue.

### Rate limits

The PRH open data APIs enforce their own rate limits (HTTP 429). Callers should
run these tools interactively, not in tight loops.
