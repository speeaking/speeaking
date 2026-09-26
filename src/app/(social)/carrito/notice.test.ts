import { describe, expect, it, vi } from "vitest";

// `notice.ts` importa `commerce/cart.ts` (con la base): aquí solo se prueba el texto.
vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("@/server/providers/storage", () => ({ getStorage: () => ({}) }));

const { removedHiddenNotice } = await import("./notice");

describe("aviso de /carrito al quitar productos ocultos", () => {
  it("nada que avisar si no se quitó nada", () => {
    expect(removedHiddenNotice(0)).toBeNull();
    expect(removedHiddenNotice(-1)).toBeNull();
  });

  it("singular y plural, sin decir por qué (no revela la moderación)", () => {
    expect(removedHiddenNotice(1)).toBe("Quitamos un producto que ya no está disponible");
    expect(removedHiddenNotice(3)).toBe("Quitamos 3 productos que ya no están disponibles");
    for (const count of [1, 3]) {
      expect(removedHiddenNotice(count)).not.toMatch(/ocult|moder|report|equipo/i);
    }
  });
});
