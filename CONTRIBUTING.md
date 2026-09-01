# Osallistuminen

Kiitos kiinnostuksesta! `datakytkin` on avoin kokoelma MCP-työkaluja, jotka tuovat
suomalaista avointa dataa ja järjestelmiä tekoälyavustajien käyttöön.

## Kehitysympäristö

```bash
nvm use            # Node 20 (.nvmrc)
npm install
npm run dev        # käynnistää MCP-palvelimen stdio-tilassa
npm run typecheck
```

## Uuden työkalun lisääminen

1. Luo `src/tools/<lahde>.ts`, joka vie:
   - `<nimi>InputSchema` – Zod-raakaskeeman olio
   - `async function <nimi>(args)` – palauttaa `{ content: [{ type: "text", text }] }`
2. Rekisteröi työkalu `src/index.ts`:ssä `server.registerTool(...)`-kutsulla.
3. Pidä ulostulo tiiviinä ihmisluettavana suomenkielisenä yhteenvetona.
4. Käsittele verkkovirheet ja aikakatkaisut – palauta selkeä virheteksti, älä heitä.
5. Päivitä `README.md`:n työkalutaulukko ja testikehotteet.

## Periaatteet

- **Vain avoin / käyttäjän omalla luvalla haettava data.** Ei kirjautumisen taakse
  meneviä kaappauksia.
- **Kohtelias rajapintakäyttö:** aseta `User-Agent`, käytä aikakatkaisuja, älä
  hakkaa rajapintoja silmukassa.
- **Ei virallinen tuote.** Työkalut käyttävät julkisia rajapintoja; ne eivät ole
  PRH:n, Hanselin, Hilman tai muidenkaan viranomaisten hyväksymiä tai ylläpitämiä.

## Pull requestit

- Yksi looginen muutos per PR.
- `npm run typecheck` ja `npm run build` menevät läpi.
- Selitä mihin rajapintaan/kenttiin muutos nojaa (linkki dokumentaatioon jos on).
