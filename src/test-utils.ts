/**
 * Testiapurit (ei mukana käännöksessä / npm-paketissa – ks. tsconfig exclude).
 */

import { vi } from "vitest";

type FakeResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

export function jsonResponse(body: unknown, status = 200): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

export function textResponse(text: string, status = 200): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => JSON.parse(text),
    text: async () => text,
  };
}

/** Mockaa global fetch reitittäen vastauksen URL-substringin perusteella. */
export function stubFetchRoutes(
  routes: { match: string; response: () => FakeResponse }[],
) {
  const fetchMock = vi.fn(async (input: unknown) => {
    const url = String(input);
    const hit = routes.find((r) => url.includes(r.match));
    if (!hit) throw new Error(`Testissä ei mockireittiä URL:lle: ${url}`);
    return hit.response();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Mockaa global fetch yhdellä vastauksella (kaikki kutsut). */
export function stubFetchOnce(response: FakeResponse) {
  const fetchMock = vi.fn(async () => response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
