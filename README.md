# suomi-mcp

[![npm](https://img.shields.io/npm/v/datakytkin-mcp.svg)](https://www.npmjs.com/package/datakytkin-mcp)
[![CI](https://github.com/datakytkin/suomi-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/datakytkin/suomi-mcp/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/datakytkin-mcp.svg)](LICENSE)

**[English summary below ↓](#english)**

Osa [datakytkin](https://github.com/datakytkin)-projektia. Kokoelma MCP-työkaluja,
jotka tuovat suomalaista avointa dataa suoraan tekoälyavustajien käyttöön – ilman
selaimessa kikkailua, PDF-latauksia tai leikepöytää.

Paikallisesti ajettava **MCP-palvelin (stdio)**, joka tuo Claude Desktopin (tai
muun MCP-yhteensopivan clientin) käyttöön kolme työkalua suomalaisiin avoimen
datan rajapintoihin:

![datakytkin-mcp demo: Claude hakee Hilmasta tarjouspyynnöt ja tarkistaa hankintayksiköiden kaupparekisteritiedot PRH:sta](https://raw.githubusercontent.com/datakytkin/suomi-mcp/main/.github/assets/demo.gif)


| Työkalu | Lähde | Mitä tekee |
| --- | --- | --- |
| `hae_yritystiedot_prh` | PRH / YTJ avoin data (`avoindata.prh.fi/opendata-ytj-api/v3`) | Hakee yrityksen perustiedot Y-tunnuksella tai nimellä: nimi, Y-tunnus, yritysmuoto, rekisteröintipäivä, toiminnan tila. |
| `hae_julkiset_hankinnat_hilma` | Hilma – julkiset hankinnat (`hankintailmoitukset.fi`) | Hakee avoinna olevat hankintailmoitukset hakusanalla: otsikko, hankintayksikkö, määräaika, suorat linkit ilmoitukseen ja tarjouspyyntöön. |
| `hae_kaupparekisteri_muutokset_prh` | PRH – rekisteröidyt ilmoitukset (`avoindata.prh.fi/opendata-registerednotices-api/v3`) | Yrityksen perustiedot + aikajana kaupparekisteriin rekisteröidyistä ilmoituksista: hallitus- ja nimenmuutokset, tilinpäätökset, osakepääoma, konkurssi/saneeraus/selvitystila. Täysi kattavuus. |

> **PRH:** vanha `avoindata.prh.fi/bis/v1` on poistettu käytöstä. Tämä palvelin
> käyttää nykyistä **v3**-rajapintaa (sama avoin YTJ-yrityshaku, ei API-avainta).
>
> **Hilma:** käytetään Hilman julkista hakurajapintaa, joka ei vaadi avainta.
> Koko ilmoituksen eForms-XML:n saa erikseen AVP-read-rajapinnasta (ilmainen
> tilausavain) – sitä ei tässä tarvita.

## Pikakäyttö

Vaatii **Node.js 18+** polussa (kehitetty ja testattu Node 20:llä).

Lisää Claude Desktopin konfiguraatioon:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "datakytkin": {
      "command": "npx",
      "args": ["-y", "datakytkin-mcp"]
    }
  }
}
```

Käynnistä Claude Desktop uudelleen. Ei tarvita erillistä asennusta – `npx` hakee
paketin npm:stä.

### Jos näet virheen `fetch is not defined`

Claude Desktop käynnistää palvelimen omalla `PATH`:llaan, ja `npx` valitsee
`#!/usr/bin/env node` -rivin kautta **ensimmäisen `node`:n `PATH`:ssa** – usein
vanhan järjestelmä-Noden (esim. v16), josta puuttuu `fetch`. Vaihda tällöin
suoraan absoluuttiseen Node 18+ -binääriin ja globaaliin asennukseen:

```bash
# asenna halutulla Nodella (esim. nvm:n Node 20)
"$(nvm which 20)" "$(dirname "$(nvm which 20)")/npm" install -g datakytkin-mcp
# tulosta polut configia varten:
echo "command: $(nvm which 20)"
echo "entry:   $("$(nvm which 20)" "$(dirname "$(nvm which 20)")/npm" root -g)/datakytkin-mcp/dist/index.js"
```

```json
{
  "mcpServers": {
    "datakytkin": {
      "command": "/ABSOLUUTTINEN/POLKU/node/v20.x.x/bin/node",
      "args": ["/ABSOLUUTTINEN/POLKU/node/v20.x.x/lib/node_modules/datakytkin-mcp/dist/index.js"]
    }
  }
}
```

`node` ajetaan tässä eksplisiittisesti, joten `PATH`:n vanha Node ei häiritse.
Päivitys: `npm install -g datakytkin-mcp@latest` samalla Nodella.

## Testikehotteet

1. *"Hae PRH:sta yrityksen tiedot Y-tunnuksella 1629284-5."*
2. *"Etsi Hilmasta avoimet pilvipalveluihin liittyvät hankintailmoitukset, näytä 5."*
3. *"Hae YTJ:stä kaikki yritykset joiden nimessä on 'Reaktor' ja listaa Y-tunnukset."*
4. *"Näytä Hilmasta it-konsultoinnin tarjouspyynnöt ja niiden määräajat."*
5. *"Listaa Y-tunnuksen 1629284-5 viimeisimmät kaupparekisteriin rekisteröidyt muutokset."*
6. *"Onko yrityksellä 1234567-8 merkintöjä konkurssista tai saneerauksesta? Milloin hallitus on viimeksi muuttunut?"*

## Kehitys

```bash
git clone https://github.com/datakytkin/suomi-mcp.git
cd suomi-mcp
nvm use 20        # tai: nvm install 20
npm install
npm run typecheck # tarkista että kääntyy
npm run dev       # käynnistä palvelin stdio-tilassa (= npx tsx src/index.ts)
```

Palvelin puhuu MCP:tä stdin/stdout-yhteydellä; lokit menevät stderriin.

Käännetty ajo:

```bash
npm run build     # tuottaa dist/
npm start         # = node dist/index.js
```

Uuden työkalun lisääminen: ks. [CONTRIBUTING.md](CONTRIBUTING.md). Käytännössä:
luo `src/tools/<lahde>.ts`, vie siitä `export const tool: ToolDefinition`, valmista –
`src/tools/registry.ts` löytää sen automaattisesti sekä stdio-palvelimeen että
Gatewayhin.

Claude Desktop -konfiguraatio repo-checkoutista (kehitykseen / omiin muutoksiin):

```json
{
  "mcpServers": {
    "datakytkin": {
      "command": "npx",
      "args": ["tsx", "/ABSOLUUTTINEN/POLKU/suomi-mcp/src/index.ts"]
    }
  }
}
```

## Datasilta-Gateway (kokeellinen)

Sama työkalusetti tarjottuna **keskitettynä HTTP-palvelimena**, jotta asiakkaan ei
tarvitse asentaa mitään paikallisesti – hän liittää yhden URL:n + tokenin suoraan
Claude Desktopiin tai Grokin Custom Connectors -kenttään.

Gateway (`src/gateway.ts`, `src/auth.ts`) elää tässä samassa repossa
(**Open Core**): koodi on MIT, kaupallinen arvo on hostatussa palvelussa +
data-integraatioissa, ei transporttikoodissa. Jos/kun mukaan tulee laskutusta tai
asiakastietoa, ne eriytetään omaksi (privaatiksi) osakseen.

```bash
npm install
DATASILTA_DEV_ALLOW_ANY=1 PORT=3000 npm run dev:gateway
```

Päätepisteet:

| Reitti | Kuvaus |
| --- | --- |
| `GET /sse?token=demo` | HTTP+SSE-kuljetus (laajin connector-tuki). Client postaa viestit `POST /messages?sessionId=…`. |
| `POST /mcp` | Streamable HTTP -kuljetus (spec-nykyinen). Token joko `Authorization: Bearer …` tai `?token=…`. Stateless. |
| `GET /healthz` | Tila + työkalulista |
| `GET /` | Lyhyt käyttöohje |

Mock-tokenit: `demo` (pro), `123` (free), `enterprise`. Kehityksessä
`DATASILTA_DEV_ALLOW_ANY=1` hyväksyy minkä tahansa ≥3 merkin tokenin.

Julkinen testaus ngrokilla:

```bash
ngrok http 3000
# -> https://xxxx.ngrok-free.app/sse?token=demo  Grokiin / Claudeen
```

> **Kokeellinen.** CORS on täysin auki ja auth on mock. Älä aja tätä julkisesti
> ilman oikeaa tokenvalidointia ja CORS-rajausta. `?token=` URL:ssa vuotaa
> lokeihin – tuotannossa `Authorization: Bearer`.

## Ei virallinen tuote

`datakytkin` on itsenäinen avoimen lähdekoodin projekti. Se käyttää PRH:n ja
Hilman julkisia rajapintoja, mutta ei ole PRH:n, Hanselin, Hilman tai minkään
viranomaisen hyväksymä, tukema tai ylläpitämä. Data tulee sellaisenaan lähteestä.

---

## English

**suomi-mcp** is part of the [datakytkin](https://github.com/datakytkin) project:
a set of [Model Context Protocol](https://modelcontextprotocol.io) tools that bring
Finnish open government data straight into AI assistants – no browser tabs, PDF
downloads or copy-paste.

A locally run **MCP server (stdio)** exposing three tools to Claude Desktop (or any
MCP-compatible client):

| Tool | Source | What it does |
| --- | --- | --- |
| `hae_yritystiedot_prh` | Finnish Patent and Registration Office (PRH) / Business Information System, open data v3 | Look up a company by Business ID or name: name, Business ID, company form, registration date, status. |
| `hae_julkiset_hankinnat_hilma` | Hilma – Finnish public procurement notices (`hankintailmoitukset.fi`) | Search open procurement notices by keyword: title, contracting entity, deadline, direct links to the notice and tender documents. |
| `hae_kaupparekisteri_muutokset_prh` | PRH – registered notices open data | Company basics + a timeline of entries registered in the Finnish Trade Register: board and name changes, financial statements, share capital, bankruptcy / restructuring / liquidation. Full coverage. |

Tool names and all output are in Finnish (that is the data's language).

### Install

Requires **Node.js 18+**. Add to your Claude Desktop config
(`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS,
`%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "datakytkin": {
      "command": "npx",
      "args": ["-y", "datakytkin-mcp"]
    }
  }
}
```

Restart Claude Desktop.

**Seeing `fetch is not defined`?** Claude Desktop launches the server with its own
`PATH`, and `npx` may pick an old system `node` (e.g. v16) that lacks `fetch`.
Install globally with a Node 18+ binary and point `command` straight at it:

```bash
npm install -g datakytkin-mcp
npm root -g   # entry = <printed path>/datakytkin-mcp/dist/index.js
```

```json
{
  "mcpServers": {
    "datakytkin": {
      "command": "/absolute/path/to/node18+/bin/node",
      "args": ["/absolute/path/to/lib/node_modules/datakytkin-mcp/dist/index.js"]
    }
  }
}
```

### Not an official product

`datakytkin` is an independent open-source project. It consumes public APIs from
PRH and Hilma but is not endorsed, supported or operated by PRH, Hansel, Hilma or
any public authority. Data is served as-is from the source. See
[SECURITY.md](SECURITY.md) for notes on the data sources and responsible use.

## Lisenssi / License

[MIT](LICENSE)
