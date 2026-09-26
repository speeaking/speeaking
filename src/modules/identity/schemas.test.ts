import { describe, expect, it } from "vitest";
import {
  accountNameSchema,
  normalizeUsername,
  RESERVED_NAME_MESSAGE,
  signInSchema,
  signUpSchema,
  usernameSchema,
} from "./schemas";

const validSignUp = {
  name: "Ana López",
  email: "Ana@Example.com ",
  password: "una-clave-segura",
  acceptTerms: "on",
};

describe("signUpSchema", () => {
  it("normaliza el correo y acepta datos válidos", () => {
    const result = signUpSchema.parse(validSignUp);

    expect(result.email).toBe("ana@example.com");
    expect(result.acceptTerms).toBe(true);
  });

  it("exige aceptar términos y aviso de privacidad", () => {
    const { acceptTerms: _omit, ...withoutTerms } = validSignUp;

    expect(signUpSchema.safeParse(withoutTerms).success).toBe(false);
  });

  it("exige contraseñas de al menos 10 caracteres", () => {
    expect(signUpSchema.safeParse({ ...validSignUp, password: "corta" }).success).toBe(false);
  });

  it("rechaza nombres vacíos y correos inválidos", () => {
    expect(signUpSchema.safeParse({ ...validSignUp, name: "  " }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...validSignUp, email: "no-es-correo" }).success).toBe(false);
  });

  it("rechaza nombres de más de 60 caracteres", () => {
    expect(signUpSchema.safeParse({ ...validSignUp, name: "a".repeat(61) }).success).toBe(false);
  });

  // SEC-18
  it.each(["Equipo VendeIA", "Soporte", "vende ia"])(
    "rechaza nombres que suplantan a la plataforma: %s",
    (name) => {
      const result = signUpSchema.safeParse({ ...validSignUp, name });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(RESERVED_NAME_MESSAGE);
    },
  );

  // SEC-30
  it.each(["contraseña123", "1234567890", "Password2026!"])(
    "rechaza contraseñas comunes: %s",
    (password) => {
      const result = signUpSchema.safeParse({ ...validSignUp, password });

      expect(result.success).toBe(false);
      expect(result.error?.issues).toEqual([
        expect.objectContaining({ path: ["password"], message: expect.stringMatching(/muy común/) }),
      ]);
    },
  );

  it("una contraseña corta solo muestra el mínimo, no «muy común»", () => {
    const result = signUpSchema.safeParse({ ...validSignUp, password: "12345" });

    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      "Usa al menos 10 caracteres.",
    ]);
  });

  it("rechaza contraseñas que contienen el correo", () => {
    const result = signUpSchema.safeParse({
      ...validSignUp,
      email: "ximena.ruiz@example.com",
      password: "Ximena.Ruiz-2026",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ path: ["password"] });
  });
});

describe("accountNameSchema", () => {
  it("recorta y acepta nombres normales", () => {
    expect(accountNameSchema.parse("  Ana López ")).toBe("Ana López");
  });
});

describe("signInSchema", () => {
  it("acepta correo y contraseña", () => {
    expect(signInSchema.safeParse({ email: "a@b.mx", password: "x" }).success).toBe(true);
  });
});

describe("usernameSchema", () => {
  it.each(["ana.lopez", "ana_22", "tienda.mx"])("acepta %s", (value) => {
    expect(usernameSchema.safeParse(value).success).toBe(true);
  });

  it.each([
    "ab",
    "con espacio",
    "ñandú",
    ".empieza",
    "termina.",
    "a".repeat(31),
    "admin",
    "studio",
    // SEC-18: prefijos y segmentos reservados, sin importar mayúsculas.
    "Equipo.Soporte",
    "equipo.gaming",
    "vendeia.oficial",
    "Soporte_MX",
    "tienda.oficial",
  ])("rechaza %s", (value) => {
    expect(usernameSchema.safeParse(value).success).toBe(false);
  });

  it("normaliza a minúsculas sin espacios alrededor", () => {
    expect(normalizeUsername("  Ana.Lopez ")).toBe("ana.lopez");
  });
});
