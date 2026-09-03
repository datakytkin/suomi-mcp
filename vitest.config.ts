import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Ei oikeita verkkokutsuja testeissä – fetch mockataan.
    clearMocks: true,
    unstubGlobals: true,
  },
});
