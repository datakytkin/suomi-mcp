# suomi-mcp

Osa [datakytkin](https://github.com/datakytkin)-projektia. Kokoelma MCP-työkaluja,
jotka tuovat suomalaista avointa dataa tekoälyavustajien käyttöön. npm-paketti:
`datakytkin-mcp`.

Paikallisesti ajettava **MCP-palvelin (stdio)**, joka tuo Claude Desktopin käyttöön
kaksi suomalaista avoimen datan rajapintaa:

| Työkalu | Lähde | Mitä tekee |
| --- | --- | --- |
| `hae_yritystiedot_prh` | PRH / YTJ avoin data (`avoindata.prh.fi/opendata-ytj-api/v3`) | Hakee yrityksen perustiedot Y-tunnuksella tai nimellä. |
| `hae_julkiset_hankinnat_hilma` | Hilma – julkiset hankinnat (`hankintailmoitukset.fi`) | Hakee avoinna olevat hankintailmoitukset hakusanalla. |

> **Huom PRH:** vanha `avoindata.prh.fi/bis/v1` on poistettu käytöstä. Tämä palvelin
> käyttää nykyistä **v3**-rajapintaa (sama avoin YTJ-yrityshaku, ei API-avainta).
>
> **Huom Hilma:** käytetään Hilman julkista hakurajapintaa, joka ei vaadi avainta.
> Koko ilmoituksen eForms-XML:n saa erikseen AVP-read-rajapinnasta (ilmainen
> tilausavain) – sitä ei tässä tarvita.

## Ei virallinen tuote

`datakytkin` on itsenäinen avoimen lähdekoodin projekti. Se käyttää PRH:n ja
Hilman julkisia rajapintoja, mutta ei ole PRH:n, Hanselin, Hilman tai minkään
viranomaisen hyväksymä, tukema tai ylläpitämä. Data tulee sellaisenaan lähteestä.

## Vaatimukset

- **Node.js 18+** (kehitetty ja testattu Node 20:llä). Node 16 ei toimi – siitä puuttuu `fetch`.

## Asennus

```bash
git clone https://github.com/datakytkin/suomi-mcp.git
cd suomi-mcp
nvm use 20        # tai: nvm install 20
npm install
npm run typecheck # valinnainen: varmista että kääntyy
```

## Ajo kehityksessä

```bash
npm run dev       # = npx tsx src/index.ts
```

Palvelin puhuu MCP:tä stdin/stdout-yhteydellä; lokit menevät stderriin.

## Käännetty ajo (valinnainen)

```bash
npm run build     # tuottaa dist/
npm start         # = node dist/index.js
```

## Claude Desktop -konfiguraatio

Tiedosto:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Korvaa `/ABSOLUUTTINEN/POLKU/suomi-mcp` kloonatun hakemiston oikealla polulla
(`pwd` kertoo sen repon juuressa).

### macOS (npx tsx)

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

Jos `nvm`-oletus on Node 16, anna Node 20:n `npx` täydellä polulla
(`nvm which 20` tulostaa `node`-binaarin polun; `npx` on samassa `bin/`-hakemistossa):

```json
{
  "mcpServers": {
    "datakytkin": {
      "command": "/ABSOLUUTTINEN/POLKU/node/v20.x.x/bin/npx",
      "args": ["tsx", "/ABSOLUUTTINEN/POLKU/suomi-mcp/src/index.ts"]
    }
  }
}
```

### Windows (npx tsx)

```json
{
  "mcpServers": {
    "datakytkin": {
      "command": "npx",
      "args": ["tsx", "C:\\Users\\<KÄYTTÄJÄ>\\datakytkin\\src\\index.ts"]
    }
  }
}
```

Käynnistä Claude Desktop uudelleen muutoksen jälkeen.

## Testikehotteet Claude Desktopissa

1. *"Hae PRH:sta yrityksen tiedot Y-tunnuksella 1629284-5."*
2. *"Etsi Hilmasta avoimet pilvipalveluihin liittyvät hankintailmoitukset, näytä 5."*
3. *"Hae YTJ:stä kaikki yritykset joiden nimessä on 'Reaktor' ja listaa Y-tunnukset."*
4. *"Näytä Hilmasta it-konsultoinnin tarjouspyynnöt ja niiden määräajat."*
