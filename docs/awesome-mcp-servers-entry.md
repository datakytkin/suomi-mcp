# awesome-mcp-servers -listaus

Valmis rivi lisättäväksi awesome-mcp-servers -tyyppisiin listoihin.
Lisää se listan sopivaan kategoriaan (esim. "Location & Weather", "Finance",
"Government / Open Data" – tai maakohtaiseen osioon).

## Rivi (englanti)

```markdown
- [datakytkin/suomi-mcp](https://github.com/datakytkin/suomi-mcp) 📇 🏠 - Finnish open government & public data in one server: company registry (PRH/YTJ), public procurement (Hilma), trade-register changes, EU VAT (VIES) check, IBAN check, electricity spot price, weather (FMI), inflation & housing & fuel prices (Statistics Finland). No API keys. npx or hosted SSE gateway.
```

Legendat vaihtelevat listoittain; yleisimmät: 📇 = TypeScript/JavaScript, 🏠 =
local/stdio, ☁️ = remote/hosted. Tarkista kohdelistan `README`:n legenda.

## Kohteet

| Lista | Miten |
| --- | --- |
| `punkpeye/awesome-mcp-servers` | Fork → lisää rivi oikeaan kategoriaan (aakkosjärjestys) → PR |
| `wong2/awesome-mcp-servers` | sama |
| [mcp.so](https://mcp.so) | "Submit" -lomake, GitHub-URL riittää |
| [glama.ai/mcp/servers](https://glama.ai/mcp/servers) | indeksoi GitHubista automaattisesti; voi nopeuttaa lomakkeella |
| [smithery.ai](https://smithery.ai) | "Add server", tarvitsee `smithery.yaml`:n repoon (stdio-komento: `npx -y datakytkin-mcp`) |

## PR-kuvaus (malli)

> Adds **datakytkin/suomi-mcp**, an MCP server bundling ~11 tools for Finnish
> open government/public data (company registry, public procurement, VAT/IBAN
> validation, electricity spot price, weather, Statistics Finland indices).
> All sources are keyless; MIT; published to npm as `datakytkin-mcp`; also runs
> as a hosted SSE gateway. Tools and output are in Finnish (the data's language).
