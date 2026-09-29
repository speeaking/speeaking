import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La instrumentación del cliente siembra `globalThis.__zod_globalConfig` antes de que cargue Zod
 * (SEC-06: sin `eval` en el navegador). Si Zod dejara de leer ese global, esta prueba lo diría.
 */
describe("instrumentation-client", () => {
  const previous = globalThis.__zod_globalConfig;

  beforeEach(() => {
    vi.resetModules();
    globalThis.__zod_globalConfig = undefined;
  });

  afterEach(() => {
    globalThis.__zod_globalConfig = previous;
  });

  it("deja a Zod sin JIT en el navegador: la configuración global queda con jitless", async () => {
    await import("./instrumentation-client");
    expect(globalThis.__zod_globalConfig).toEqual({ jitless: true });

    const core = await import("zod/v4/core");
    expect(core.globalConfig.jitless).toBe(true);
    expect(core.globalConfig).toBe(globalThis.__zod_globalConfig);
  });

  it("no pisa lo que ya estuviera configurado", async () => {
    globalThis.__zod_globalConfig = { jitless: false };
    const before = globalThis.__zod_globalConfig;
    await import("./instrumentation-client");
    expect(globalThis.__zod_globalConfig).toEqual({ jitless: true });
    expect(globalThis.__zod_globalConfig).not.toBe(before);
  });
});
