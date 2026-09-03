import { afterEach, describe, expect, it } from "vitest";

import { validateToken } from "./auth.js";

describe("validateToken", () => {
  const orig = process.env.DATASILTA_DEV_ALLOW_ANY;
  afterEach(() => {
    if (orig === undefined) delete process.env.DATASILTA_DEV_ALLOW_ANY;
    else process.env.DATASILTA_DEV_ALLOW_ANY = orig;
  });

  it("hyväksyy tunnetun mock-tokenin ja liittää planin + tokenin", () => {
    expect(validateToken("demo")).toMatchObject({
      customerId: "cus_demo",
      plan: "pro",
      token: "demo",
    });
    expect(validateToken("123")?.plan).toBe("free");
    expect(validateToken("enterprise")?.plan).toBe("enterprise");
  });

  it("hylkää tuntemattoman tokenin (ilman DEV_ALLOW_ANY)", () => {
    delete process.env.DATASILTA_DEV_ALLOW_ANY;
    expect(validateToken("ei-ole")).toBeNull();
  });

  it("hylkää tyhjän tai puuttuvan tokenin", () => {
    expect(validateToken(undefined)).toBeNull();
    expect(validateToken(null)).toBeNull();
    expect(validateToken("")).toBeNull();
  });

  it("DEV_ALLOW_ANY=1: mikä tahansa >=3 merkin token kelpaa free-planilla", () => {
    process.env.DATASILTA_DEV_ALLOW_ANY = "1";
    expect(validateToken("abcd")).toMatchObject({ plan: "free" });
    expect(validateToken("ab")).toBeNull();
    expect(validateToken("has space")).toBeNull();
  });
});
