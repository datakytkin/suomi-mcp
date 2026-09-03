/**
 * Mock-tokenvalidointi Gatewaylle.
 *
 * TODO (tuotanto): korvaa oikealla asiakas-/tilaustietokannalla. Token pitäisi
 * lukea mieluiten `Authorization: Bearer` -otsakkeesta; `?token=` URL:ssa on
 * tässä vaiheessa sallittu, koska osa connector-UI:sta (Grok, jotkut Claude-
 * flowt) sallii vain URL:n liittämisen. Kohtele tokenia salaisuutena: vain TLS,
 * lyhyt elinikä, kierrätys, älä logita.
 */

import type { Principal } from "./tools/types.js";

type MockEntry = Omit<Principal, "token">;

const MOCK_TOKENS: Record<string, MockEntry> = {
  demo: { customerId: "cus_demo", plan: "pro" },
  "123": { customerId: "cus_test_123", plan: "free" },
  enterprise: { customerId: "cus_enterprise", plan: "enterprise" },
};

/**
 * Palauttaa Principalin validille tokenille, muuten null.
 *
 * Kehitys: aseta `DATASILTA_DEV_ALLOW_ANY=1`, jolloin mikä tahansa ≥3 merkin
 * token kelpaa (plan "free"). Älä käytä tuotannossa.
 */
export function validateToken(token: string | undefined | null): Principal | null {
  if (!token) return null;

  const known = MOCK_TOKENS[token];
  if (known) return { ...known, token };

  if (process.env.DATASILTA_DEV_ALLOW_ANY === "1" && /^[\w-]{3,}$/.test(token)) {
    return { customerId: `cus_anon_${token.slice(0, 12)}`, plan: "free", token };
  }

  return null;
}
