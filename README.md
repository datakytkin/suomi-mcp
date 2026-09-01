# suomi-mcp

[![npm](https://img.shields.io/npm/v/datakytkin-mcp.svg)](https://www.npmjs.com/package/datakytkin-mcp)
[![CI](https://github.com/datakytkin/suomi-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/datakytkin/suomi-mcp/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/datakytkin-mcp.svg)](LICENSE)

Osa [datakytkin](https://github.com/datakytkin)-projektia. Kokoelma MCP-työkaluja,
jotka tuovat suomalaista avointa dataa suoraan tekoälyavustajien käyttöön – ilman
selaimessa kikkailua, PDF-latauksia tai leikepöytää.

Paikallisesti ajettava **MCP-palvelin (stdio)**, joka tuo Claude Desktopin (tai
muun MCP-yhteensopivan clientin) käyttöön kaksi suomalaista avoimen datan
rajapintaa:

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

Jos `nvm`-oletuksesi on vanhempi Node, anna Node 20:n `npx` täydellä polulla
(`nvm which 20` tulostaa `node`-binaarin polun; `npx` on samassa `bin/`-hakemistossa):

```json
{
  "mcpServers": {
    "datakytkin": {
      "command": "/ABSOLUUTTINEN/POLKU/node/v20.x.x/bin/npx",
      "args": ["-y", "datakytkin-mcp"]
    }
  }
}
```

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

Uuden työkalun lisääminen: ks. [CONTRIBUTING.md](CONTRIBUTING.md).

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

## Ei virallinen tuote

`datakytkin` on itsenäinen avoimen lähdekoodin projekti. Se käyttää PRH:n ja
Hilman julkisia rajapintoja, mutta ei ole PRH:n, Hanselin, Hilman tai minkään
viranomaisen hyväksymä, tukema tai ylläpitämä. Data tulee sellaisenaan lähteestä.

## Lisenssi

[MIT](LICENSE)
