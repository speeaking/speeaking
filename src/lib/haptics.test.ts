import { afterEach, describe, expect, it, vi } from "vitest";
import { TAP_MS, tapHaptic } from "./haptics";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tapHaptic (ADR-052)", () => {
  it("vibra 10 ms donde el navegador lo permite", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });

    expect(tapHaptic()).toBe(true);
    expect(vibrate).toHaveBeenCalledWith(TAP_MS);
  });

  it("no vibra con «menos movimiento», ni donde no existe, ni si el navegador falla", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    expect(tapHaptic()).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();

    vi.stubGlobal("navigator", {});
    expect(tapHaptic()).toBe(false);

    vi.stubGlobal("navigator", {
      vibrate: () => {
        throw new Error("no permitido");
      },
    });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
    expect(tapHaptic()).toBe(false);
  });
});
