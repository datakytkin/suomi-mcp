# Muutosloki

Merkittävät muutokset. Formaatti mukailee [Keep a Changelog](https://keepachangelog.com/fi/1.1.0/)
-tyyliä; versiot ovat [semver](https://semver.org/lang/fi/).

## [0.5.0]

### Lisätty

- **`tarkista_iban`** – IBAN-tilinumeron rakenteen ja tarkistusnumeron (mod-97)
  tarkistus. Suomalaiselle IBANille kansallinen tilinumero + arvio pankista.
  Ei verkkokutsuja.
- **`hae_asuntojen_hinnat`** – vanhojen osakeasuntojen neliöhinnat ja kauppamäärät
  postinumeroalueittain talotyypeittäin (Tilastokeskus, taulu ashi/13mu).
- **`hae_polttoaineen_hinnat`** – bensiinin, dieselin ja kevyen polttoöljyn
  keskihinta viimeisimmältä tilastokuukaudelta + muutos ed. kuukauteen ja
  vuoden takaiseen (Tilastokeskus, taulu khi/11xx).
- `CHANGELOG.md`, `docs/` (jakelumateriaali).

## [0.4.0]

### Lisätty

- **`tarkista_alv_tunnus`** – EU:n ALV-tunnuksen voimassaolo + rekisteröity nimi
  ja osoite (EU VIES).
- **`hae_saa`** – sääennuste tunneittain paikkakunnalle (Ilmatieteen laitos).
- **`laske_inflaatio`** – rahan ostovoiman muutos vuosien välillä
  (Tilastokeskus, elinkustannusindeksi, sarja vuodesta 1951).
- **`hae_hankintailmoitus`** – yhden Hilma-hankinnan kaikki tiedot.

### Muutettu

- `hae_yritystiedot_prh` näyttää nyt myös toimialan (TOL), kotipaikan,
  verkkosivun ja rekisterimerkinnät (ALV / ennakkoperintä / työnantaja).

## [0.3.0]

### Lisätty

- **`hae_porssisahko`** – Suomen pörssisähkön tuntihinnat (porssisahko.net).
- **Datasilta-Gateway** (kokeellinen) – keskitetty HTTP-palvelin: `GET /sse` +
  `POST /messages` (SDK-kanoninen SSE) ja stateless `POST /mcp` (Streamable HTTP).
  Token `?token=` tai `Authorization: Bearer`. Kovennukset: plan-kohtainen rate
  limit, `X-Request-Id` + pyyntöloki, rinnakkaisten SSE-sessioiden katto,
  graceful shutdown.
- **Tool annotations** – työkalut merkitty `readOnlyHint` / `openWorldHint` /
  `idempotentHint`.
- Jaettu työkalurekisteri (`src/tools/registry.ts`): uusi työkalu = pudota
  tiedosto `src/tools/`-kansioon.
- Testit (vitest), CI ajaa ne Node 18/20/22.

## [0.2.0]

### Lisätty

- **`hae_kaupparekisteri_muutokset_prh`** – yrityksen perustiedot + aikajana
  kaupparekisteriin rekisteröidyistä ilmoituksista (PRH rekisteröidyt ilmoitukset).

## [0.1.0]

### Lisätty

- Ensimmäinen julkaisu: stdio-MCP-palvelin, työkalut `hae_yritystiedot_prh`
  (PRH/YTJ) ja `hae_julkiset_hankinnat_hilma` (Hilma).

[0.5.0]: https://github.com/datakytkin/suomi-mcp/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/datakytkin/suomi-mcp/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/datakytkin/suomi-mcp/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/datakytkin/suomi-mcp/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/datakytkin/suomi-mcp/releases/tag/v0.1.0
