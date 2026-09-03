import { beforeEach, describe, expect, it } from "vitest";

import { _resetBuckets, consume, limitsFor } from "./rate-limit.js";

describe("rate-limit", () => {
  beforeEach(() => _resetBuckets());

  it("limitsFor: tunnetut planit + fallback free tuntemattomalle", () => {
    expect(limitsFor("free").callsPerMinute).toBe(20);
    expect(limitsFor("pro").callsPerMinute).toBe(120);
    expect(limitsFor("enterprise").maxConcurrentSessions).toBe(50);
    expect(limitsFor("outo")).toEqual(limitsFor("free"));
  });

  it("sallii kapasiteetin verran kutsuja, sitten 429 + Retry-After", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 20; i++) {
      expect(consume("c1", "free", t0).allowed).toBe(true);
    }
    const over = consume("c1", "free", t0);
    expect(over.allowed).toBe(false);
    expect(over.remaining).toBe(0);
    expect(over.retryAfterSec).toBeGreaterThan(0);
  });

  it("token bucket täydentyy ajan myötä", () => {
    const t0 = 2_000_000;
    for (let i = 0; i < 20; i++) consume("c2", "free", t0);
    expect(consume("c2", "free", t0).allowed).toBe(false);
    expect(consume("c2", "free", t0 + 60_000).allowed).toBe(true);
  });

  it("eri asiakkaat eivät jaa laskuria", () => {
    const t0 = 3_000_000;
    for (let i = 0; i < 20; i++) consume("a", "free", t0);
    expect(consume("a", "free", t0).allowed).toBe(false);
    expect(consume("b", "free", t0).allowed).toBe(true);
  });

  it("pro-plan sallii enemmän kuin free", () => {
    const t0 = 4_000_000;
    for (let i = 0; i < 100; i++) {
      expect(consume("p", "pro", t0).allowed).toBe(true);
    }
  });
});
