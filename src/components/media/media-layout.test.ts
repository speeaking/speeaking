import { describe, expect, it } from "vitest";
import { collageLayout, dotWindow, MAX_DOTS } from "./media-layout";

const indexes = (count: number, active: number) => dotWindow(count, active).map((dot) => dot.index);
const sizes = (count: number, active: number) => dotWindow(count, active).map((dot) => dot.size);

describe("dotWindow", () => {
  it("con pocas fotos muestra un punto por foto, todos del mismo tamaño", () => {
    expect(indexes(3, 1)).toEqual([0, 1, 2]);
    expect(sizes(3, 1)).toEqual(["lg", "lg", "lg"]);
    expect(dotWindow(MAX_DOTS, 0)).toHaveLength(MAX_DOTS);
  });

  it("con muchas fotos muestra a lo más 7 puntos y encoge la orilla con fotos ocultas", () => {
    expect(indexes(10, 0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(sizes(10, 0)).toEqual(["lg", "lg", "lg", "lg", "lg", "md", "sm"]);
  });

  it("centra la ventana en la foto actual y encoge ambas orillas", () => {
    expect(indexes(10, 5)).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(sizes(10, 5)).toEqual(["sm", "md", "lg", "lg", "lg", "md", "sm"]);
  });

  it("al final la ventana se pega a la última foto", () => {
    expect(indexes(10, 9)).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(sizes(10, 9)).toEqual(["sm", "md", "lg", "lg", "lg", "lg", "lg"]);
  });

  it("la foto actual siempre está en la ventana y con tamaño completo", () => {
    for (let active = 0; active < 10; active++) {
      const dot = dotWindow(10, active).find((item) => item.index === active);
      expect(dot?.size).toBe("lg");
    }
  });

  it("sin fotos no hay puntos", () => {
    expect(dotWindow(0, 0)).toEqual([]);
  });
});

describe("collageLayout", () => {
  it("usa una forma por cantidad y resume el resto con +N", () => {
    expect(collageLayout(1)).toEqual({ tiles: 1, overflow: 0, aspect: 1 });
    expect(collageLayout(2)).toEqual({ tiles: 2, overflow: 0, aspect: 4 / 3 });
    expect(collageLayout(3)).toEqual({ tiles: 3, overflow: 0, aspect: 1 });
    expect(collageLayout(4)).toEqual({ tiles: 4, overflow: 0, aspect: 1 });
    expect(collageLayout(10)).toEqual({ tiles: 4, overflow: 6, aspect: 1 });
  });

  it("sin fotos no hay mosaicos", () => {
    expect(collageLayout(0).tiles).toBe(0);
  });
});
