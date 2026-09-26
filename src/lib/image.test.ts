import { describe, expect, it } from "vitest";
import { FEED_FRAME, fitForFrame, frameAspect, PRODUCT_FRAME } from "./image";

describe("frameAspect", () => {
  it("respeta la proporción de la foto dentro del rango del feed", () => {
    expect(frameAspect({ width: 1000, height: 1000 })).toBe(1);
    expect(frameAspect({ width: 1600, height: 1000 })).toBeCloseTo(1.6);
  });

  it("acota las fotos muy altas a 4:5 y las muy anchas a 1.91:1", () => {
    expect(frameAspect({ width: 900, height: 1600 })).toBe(FEED_FRAME.min);
    expect(frameAspect({ width: 3000, height: 1000 })).toBe(FEED_FRAME.max);
  });

  it("en productos el marco va de 4:5 a cuadrado, nunca horizontal", () => {
    expect(frameAspect({ width: 900, height: 1600 }, PRODUCT_FRAME)).toBe(4 / 5);
    expect(frameAspect({ width: 1600, height: 900 }, PRODUCT_FRAME)).toBe(1);
  });

  it("con medidas inválidas usa un cuadrado dentro del rango", () => {
    expect(frameAspect({ width: 0, height: 0 })).toBe(1);
    expect(frameAspect({ width: 100, height: 0 })).toBe(1);
  });
});

describe("fitForFrame", () => {
  it("llena el marco cuando la foto casi coincide", () => {
    expect(fitForFrame({ width: 800, height: 1000 }, 4 / 5)).toBe("cover");
    // 3:4 en un marco 4:5 recorta ~6 %.
    expect(fitForFrame({ width: 750, height: 1000 }, 4 / 5)).toBe("cover");
  });

  it("muestra la foto completa cuando recortaría demasiado", () => {
    // Cuadrada en 4:5 recortaría 20 %; vertical 9:16 en cuadrado, 44 %.
    expect(fitForFrame({ width: 1000, height: 1000 }, 4 / 5)).toBe("contain");
    expect(fitForFrame({ width: 900, height: 1600 }, 1)).toBe("contain");
    expect(fitForFrame({ width: 1600, height: 900 }, 4 / 5)).toBe("contain");
  });

  it("con medidas inválidas no arriesga un recorte", () => {
    expect(fitForFrame({ width: 0, height: 0 }, 1)).toBe("contain");
    expect(fitForFrame({ width: 100, height: 0 }, 1)).toBe("contain");
  });
});
