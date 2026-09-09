# Lanseerauspostin luonnokset

Muokkaa ääntä ja pituutta kanavan mukaan. Demo-GIF (`.github/assets/demo.gif`)
kannattaa liittää mukaan siellä missä kuva näkyy.

---

## LinkedIn (suomeksi, pk-/konsulttiverkosto)

> **Suomalainen avoin data suoraan tekoälyavustajaan – ilman selaimessa
> kikkailua.**
>
> Julkaisin `datakytkin-mcp`:n: avoimen lähdekoodin MCP-palvelin joka tuo Claude
> Desktopiin (ja muihin MCP-clientteihin) ~11 työkalua suomalaiseen julkiseen
> dataan:
>
> • Yritystiedot (PRH/YTJ) – toimiala, kotipaikka, ALV-rekisteristatus
> • Julkiset hankinnat (Hilma) – haku + yksittäisen hankinnan kaikki tiedot
> • Kaupparekisterin muutokset – hallitus, tilinpäätökset, konkurssi/saneeraus
> • EU-ALV-tunnuksen tarkistus (VIES), IBAN-tarkistus
> • Pörssisähkön hinta, sääennuste (Ilmatieteen laitos)
> • Inflaatio, asuntojen neliöhinnat, polttoaineen hinnat (Tilastokeskus)
>
> Kaikki lähteet ovat avoimia, ei API-avaimia. Asennus: `npx -y datakytkin-mcp`.
> MIT-lisenssi.
>
> Esimerkki: "Etsi Hilmasta avoimet IT-konsultoinnin tarjouspyynnöt ja tarkista
> jokaisen hankintayksikön kaupparekisteritilanne." → tekoäly tekee sen yhdellä
> kysymyksellä.
>
> Repo: github.com/datakytkin/suomi-mcp

---

## r/mcp (englanti)

> **suomi-mcp: Finnish open government data as MCP tools (no API keys)**
>
> I put together an MCP server that bundles ~11 tools for Finnish public data
> into one install:
>
> - Company registry (PRH/YTJ): look up a company, see industry, domicile, VAT
>   register status
> - Public procurement (Hilma): keyword search + full details of a single notice
> - Trade-register changes: board/name changes, financial statements, bankruptcy
> - EU VAT number check (VIES), IBAN check (offline)
> - Electricity spot price, weather forecast (FMI)
> - Inflation, housing m² prices by postal code, fuel prices (Statistics Finland)
>
> Every source is keyless. `npx -y datakytkin-mcp`, MIT. Tool names/output are in
> Finnish since that's the data's language. It also runs as a hosted SSE gateway
> if you don't want a local install.
>
> https://github.com/datakytkin/suomi-mcp

---

## Show HN (englanti, tiivis)

> **Show HN: suomi-mcp – Finnish open-government data as MCP tools**
>
> One MCP server, ~11 tools: company registry, public procurement, trade-register
> changes, EU VAT + IBAN validation, electricity spot price, weather, and
> Statistics Finland indices (inflation, housing, fuel). All sources keyless.
> `npx -y datakytkin-mcp`. MIT. Also a hosted SSE gateway.
>
> The gap it fills: the frontier models keep getting better, but they won't build
> deep hooks into Finnish public registries. That context/action layer is where
> the value is – this is the open-source start of it.
>
> https://github.com/datakytkin/suomi-mcp

---

## Suomalaiset dev-yhteisöt (Slack/Discord, lyhyt)

> Tein MCP-palvelimen joka tuo suomalaisen avoimen datan (PRH, Hilma,
> Tilastokeskus, Ilmatieteen laitos, VIES) tekoälyavustajien käyttöön yhdellä
> asennuksella: `npx -y datakytkin-mcp`. Keyless, MIT, palautetta otetaan
> vastaan. github.com/datakytkin/suomi-mcp
