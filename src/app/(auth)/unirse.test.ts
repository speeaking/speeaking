import { describe, expect, it } from "vitest";
import { onboardingPath, parseJoinSlugs, unwrapOnboardingNext } from "./unirse";

describe("?unirse=", () => {
  it("acepta uno o varios slugs con forma válida, sin repetir y hasta 5", () => {
    expect(parseJoinSlugs("gaming")).toEqual(["gaming"]);
    expect(parseJoinSlugs(["gaming", "gaming", "comida"])).toEqual(["gaming", "comida"]);
    expect(parseJoinSlugs(["a", "b", "c", "d", "e", "f"])).toHaveLength(5);
    expect(parseJoinSlugs(undefined)).toEqual([]);
  });

  it("ignora lo que no es un slug", () => {
    expect(parseJoinSlugs(["Gaming", "../admin", "", "a b", "comida"])).toEqual(["comida"]);
  });

  it("arma la URL del onboarding con las comunidades y a dónde volver", () => {
    expect(onboardingPath({ join: ["gaming"], next: "/p/1" })).toBe(
      "/bienvenida?unirse=gaming&next=%2Fp%2F1",
    );
    expect(onboardingPath({ join: [], next: "" })).toBe("/bienvenida");
  });

  it("desenvuelve el onboarding que el registro manda en `next`", () => {
    const next = onboardingPath({ join: ["gaming", "comida"], next: "/p/1" });

    expect(unwrapOnboardingNext(next)).toEqual({ join: ["gaming", "comida"], next: "/p/1" });
    expect(unwrapOnboardingNext("/p/1")).toBeNull();
    expect(unwrapOnboardingNext("")).toBeNull();
  });

  it("nunca vuelve al onboarding ni sale del sitio", () => {
    expect(unwrapOnboardingNext("/bienvenida?unirse=gaming&next=%2Fbienvenida")).toEqual({
      join: ["gaming"],
      next: "",
    });
    expect(unwrapOnboardingNext("/bienvenida?next=https%3A%2F%2Fotro.com")?.next).toBe("");
    expect(unwrapOnboardingNext("//otro.com/bienvenida")).toBeNull();
  });

  // SEC-04: `/bienvenida?next=/.//evil.example/entrar` sacaba del sitio tras iniciar sesión.
  it("descarta un `next` anidado que se normaliza a otro dominio", () => {
    expect(
      unwrapOnboardingNext("/bienvenida?next=%2F.%2F%2Fevil.example%2Fentrar")?.next,
    ).toBe("");
    expect(unwrapOnboardingNext("/bienvenida?next=/a/..//evil.example")?.next).toBe("");
    expect(unwrapOnboardingNext("/./bienvenida?next=%2F%252e%2F%2Fevil.example")?.next).toBe("");
    // Dos niveles: el de adentro vuelve al onboarding y se descarta.
    expect(
      unwrapOnboardingNext(
        onboardingPath({ join: [], next: "/bienvenida?next=%2F.%2F%2Fevil.example" }),
      ),
    ).toEqual({ join: [], next: "" });
    expect(unwrapOnboardingNext("/.//evil.example/bienvenida")).toBeNull();
  });
});
