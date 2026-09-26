import { describe, expect, it } from "vitest";
import { policyViolation } from "./content-policy";

describe("policyViolation", () => {
  it.each([
    ["counterfeit", "Bolsa Louis Vuitton réplica AAA"],
    ["counterfeit", "Tenis Jordan calidad espejo"],
    ["counterfeit", "Perfume clon de Sauvage"],
    ["counterfeit", "Playera pirata del América"],
    ["weapons", "Pistola 9 mm con cargador"],
    ["weapons", "Cartuchos calibre .22"],
    ["drugs", "Gomitas con THC"],
    ["prescription", "Clonazepam 2 mg"],
    ["prescription", "Antibióticos para la garganta"],
    ["vapes", "Vape desechable sabor mango"],
    ["vapes", "Cigarro electrónico recargable"],
  ] as const)("bloquea %s: «%s»", (kind, text) => {
    expect(policyViolation(text)).toBe(kind);
  });

  it.each([
    "Pistola de silicón para manualidades",
    "Pistola de agua para niños",
    "Pistolas de calor para vinil",
    "Lentes de sol sin receta",
    "Pilas AAA recargables",
    "Chamarra de piel con tachas",
    "Mota para maquillaje",
    "AirPods Pro 2 originales",
    "Clonadora de discos duros",
  ])("no bloquea productos legítimos: «%s»", (text) => {
    expect(policyViolation(text)).toBeNull();
  });

  it("revisa el texto normalizado (letras de ancho completo, caracteres invisibles)", () => {
    expect(policyViolation("ｖａｐｅ desechable")).toBe("vapes");
    expect(policyViolation("ré\u200Bplica")).toBe("counterfeit");
  });
});
