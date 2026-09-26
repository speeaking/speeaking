import { describe, expect, it } from "vitest";
import { statusAfterEdit, statusAfterToggle, toggleTargetFor } from "./status";

describe("statusAfterEdit (inventario editado por el vendedor)", () => {
  it("activo sin piezas pasa a agotado y agotado con piezas vuelve a estar activo", () => {
    expect(statusAfterEdit("ACTIVE", 0)).toBe("SOLD_OUT");
    expect(statusAfterEdit("ACTIVE", 3)).toBe("ACTIVE");
    expect(statusAfterEdit("SOLD_OUT", 1)).toBe("ACTIVE");
    expect(statusAfterEdit("SOLD_OUT", 0)).toBe("SOLD_OUT");
  });

  it("pausado sigue pausado aunque cambie el inventario", () => {
    expect(statusAfterEdit("PAUSED", 0)).toBe("PAUSED");
    expect(statusAfterEdit("PAUSED", 10)).toBe("PAUSED");
  });

  it("borrador y archivado no cambian", () => {
    expect(statusAfterEdit("DRAFT", 5)).toBe("DRAFT");
    expect(statusAfterEdit("ARCHIVED", 0)).toBe("ARCHIVED");
  });
});

describe("statusAfterToggle (pausar y reactivar)", () => {
  it("pausa productos activos o agotados", () => {
    expect(statusAfterToggle("ACTIVE", "PAUSED", 4)).toBe("PAUSED");
    expect(statusAfterToggle("SOLD_OUT", "PAUSED", 0)).toBe("PAUSED");
    expect(statusAfterToggle("PAUSED", "PAUSED", 4)).toBe("PAUSED");
  });

  it("reactivar depende de las piezas: sin inventario queda agotado", () => {
    expect(statusAfterToggle("PAUSED", "ACTIVE", 4)).toBe("ACTIVE");
    expect(statusAfterToggle("PAUSED", "ACTIVE", 0)).toBe("SOLD_OUT");
    expect(statusAfterToggle("ACTIVE", "ACTIVE", 4)).toBe("ACTIVE");
  });

  it("no aplica a borradores ni archivados", () => {
    expect(statusAfterToggle("DRAFT", "ACTIVE", 4)).toBeNull();
    expect(statusAfterToggle("ARCHIVED", "PAUSED", 4)).toBeNull();
  });
});

describe("toggleTargetFor (qué botón muestra el Studio)", () => {
  it("ofrece pausar lo que está a la venta y reactivar lo pausado", () => {
    expect(toggleTargetFor("ACTIVE")).toBe("PAUSED");
    expect(toggleTargetFor("SOLD_OUT")).toBe("PAUSED");
    expect(toggleTargetFor("PAUSED")).toBe("ACTIVE");
    expect(toggleTargetFor("DRAFT")).toBeNull();
    expect(toggleTargetFor("ARCHIVED")).toBeNull();
  });
});
