import { describe, expect, it } from "vitest";
import {
  caseNumbersSentence,
  formatCaseList,
  formatCaseNumber,
  parseCaseNumber,
} from "./case-number";

describe("número de caso", () => {
  it("se muestra con prefijo y seis cifras", () => {
    expect(formatCaseNumber(123)).toBe("DA-000123");
    expect(formatCaseNumber(1)).toBe("DA-000001");
    expect(formatCaseNumber(1234567)).toBe("DA-1234567");
  });

  it("se lee como lo escribe la gente, sin aceptar otra cosa", () => {
    expect(parseCaseNumber("DA-000123")).toBe(123);
    expect(parseCaseNumber(" da-123 ")).toBe(123);
    expect(parseCaseNumber("DA123")).toBe(123);
    for (const value of [
      "",
      "123",
      "DA-",
      "DA-0",
      "DA-12a",
      "XX-000123",
      "DA-99999999999",
      null,
      7,
    ]) {
      expect(parseCaseNumber(value)).toBeNull();
    }
  });

  it("varios casos se leen como una lista en español", () => {
    expect(formatCaseList([7])).toBe("DA-000007");
    expect(formatCaseList([7, 8])).toBe("DA-000007 y DA-000008");
    expect(formatCaseList([7, 8, 9])).toBe("DA-000007, DA-000008 y DA-000009");
  });

  it("quien avisa lee su número de caso, o uno por cada cuenta que subió lo señalado", () => {
    expect(caseNumbersSentence([123])).toBe("Tu número de caso es DA-000123: guárdalo.");
    expect(caseNumbersSentence([123, 124])).toBe(
      "Lo que señalaste lo subieron 2 cuentas distintas, así que abrimos un caso para cada una: DA-000123 y DA-000124. Guárdalos: cada cuenta puede responder por su lado.",
    );
  });
});
