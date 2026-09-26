import { describe, expect, it } from "vitest";
import { normalizeInterest, onboardingSchema, suggestUsername } from "./onboarding-schema";

function form(entries: [string, string][]) {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

const base: [string, string][] = [
  ["username", "Ana.Lopez"],
  ["displayName", "Ana López"],
  ["goals", "DISCOVER"],
  ["goals", "SELL"],
  ["communities", "gaming"],
  ["communities", "tecnologia"],
  ["communities", "comida"],
];

describe("onboardingSchema.fromFormData", () => {
  it("lee listas repetidas y normaliza el usuario", () => {
    const result = onboardingSchema.fromFormData(form(base));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.username).toBe("ana.lopez");
    expect(result.data.goals).toEqual(["DISCOVER", "SELL"]);
    expect(result.data.communities).toHaveLength(3);
    expect(result.data.personalizationEnabled).toBe(false);
  });

  it("un nombre demasiado largo solo muestra el máximo, sin revisar suplantación", () => {
    const result = onboardingSchema.fromFormData(
      form([
        ...base.filter(([key]) => key !== "displayName"),
        ["displayName", "Soporte ".repeat(1e5)],
      ]),
    );

    expect(result.error?.issues.map((issue) => issue.message)).toEqual(["Máximo 50 caracteres."]);
  });

  it("exige al menos 3 comunidades", () => {
    const result = onboardingSchema.fromFormData(form(base.slice(0, 5)));

    expect(result.success).toBe(false);
  });

  it("convierte el presupuesto en pesos a centavos y limpia marcas", () => {
    const result = onboardingSchema.fromFormData(
      form([
        ...base,
        ["intentQuery", "  laptop para edición "],
        ["budgetMax", "25,000"],
        ["brands", "Apple"],
        ["brands", " apple "],
        ["brands", "Lenovo"],
        ["personalization", "on"],
      ]),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.intentQuery).toBe("laptop para edición");
    expect(result.data.budgetMaxCents).toBe(2_500_000);
    expect(result.data.brands).toEqual(["Apple", "Lenovo"]);
    expect(result.data.personalizationEnabled).toBe(true);
  });

  // SEC-18
  it.each([
    ["displayName", "Equipo VendeIA"],
    ["displayName", "Soporte técnico"],
    ["username", "equipo.soporte"],
    ["username", "vendeia.oficial"],
  ])("rechaza %s que suplanta a la plataforma: %s", (field, value) => {
    const entries = base.map(([key, current]): [string, string] => [
      key,
      key === field ? value : current,
    ]);
    const result = onboardingSchema.fromFormData(form(entries));

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([field]);
  });

  it("rechaza objetivos desconocidos y presupuestos inválidos", () => {
    expect(onboardingSchema.fromFormData(form([...base, ["goals", "HACK"]])).success).toBe(false);
    expect(onboardingSchema.fromFormData(form([...base, ["budgetMax", "-5"]])).success).toBe(false);
  });
});

describe("normalizeInterest", () => {
  it("compara marcas sin mayúsculas ni acentos", () => {
    expect(normalizeInterest("  L'Oréal ")).toBe("l'oreal");
  });
});

describe("suggestUsername", () => {
  it("genera un usuario válido a partir del nombre", () => {
    expect(suggestUsername("José María Pérez")).toBe("jose.maria.perez");
    expect(suggestUsername("  ")).toBe("usuario");
    expect(suggestUsername("A")).toBe("usuario.a");
  });

  it("no sugiere usuarios reservados", () => {
    expect(suggestUsername("Soporte Técnico")).toBe("usuario");
    expect(suggestUsername("Equipo Gamer")).toBe("usuario");
  });
});
