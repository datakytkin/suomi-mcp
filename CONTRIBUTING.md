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

1. Luo `src/tools/<lahde>.ts`.
2. Vie siitä **`export const tool: ToolDefinition`** (tai `export const tools: ToolDefinition[]`):
   ```ts
   import type { ToolDefinition } from "./types.js";
   export const tool: ToolDefinition<{ hakusana: string }> = {
     name: "hae_...",
     title: "…",
     description: "Mitä tekee + mitä parametreja odottaa.",
     inputSchema: { hakusana: z.string().min(1).describe("…") },
     handler: async ({ hakusana }, ctx) => ({ content: [{ type: "text", text: "…" }] }),
   };
   ```
3. Valmista – `src/tools/registry.ts` löytää sen automaattisesti. Sama työkalu
   tulee sekä stdio-palvelimeen (`src/index.ts`) että Datasilta-Gatewayhin
   (`src/gateway.ts`). **Älä** rekisteröi mitään käsin `index.ts`:ssä.
4. Pidä ulostulo tiiviinä ihmisluettavana suomenkielisenä yhteenvetona.
5. Käsittele verkkovirheet ja aikakatkaisut – palauta selkeä virheteksti, älä heitä
   (Gateway käärii heitot silti `isError`-vastaukseksi, mutta selkeä teksti on parempi).
6. Päivitä `README.md`:n työkalutaulukko ja testikehotteet.

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
