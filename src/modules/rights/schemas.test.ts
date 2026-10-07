import { z } from "zod";
import { describe, expect, it } from "vitest";
import { counterNoticeInputSchema, noticeInputSchema, rightsAdminActionSchema } from "./schemas";

const VALID = {
  kind: "COPYRIGHT",
  claimantName: "Estudio Fotográfico Luz, S.A. de C.V.",
  claimantEmail: "  Avisos@EstudioLuz.mx ",
  claimantAltEmail: "",
  claimantPhone: "",
  claimantDomicile: "Av. Reforma 100, Col. Juárez, Cuauhtémoc, 06600, Ciudad de México",
  claimantRole: "OWNER",
  principalName: "",
  trademarkRegistration: "",
  workDescription: "Fotografía «Atardecer en Bacalar», publicada en mi portafolio en 2024.",
  rightDescription: "Soy la autora y titular de los derechos patrimoniales de la fotografía.",
  facts: "La cuenta publicó mi foto sin permiso y sin crédito para vender un tour.",
  urls: "https://www.speeaking.com/p/0192f0c4-7b1a-7c3e-9d2f-1a2b3c4d5e6f\nhttps://otro.example/x",
  swornStatement: "on",
  penaltyAcknowledged: "on",
};

function errors(input: Record<string, unknown>) {
  const parsed = noticeInputSchema.safeParse(input);
  return parsed.success ? {} : z.flattenError(parsed.error).fieldErrors;
}

describe("aviso de derechos", () => {
  it("acepta un aviso completo y deja los opcionales vacíos como ausentes", () => {
    const parsed = noticeInputSchema.parse(VALID);
    expect(parsed).toMatchObject({
      kind: "COPYRIGHT",
      claimantEmail: "avisos@estudioluz.mx",
      claimantAltEmail: undefined,
      claimantPhone: undefined,
      principalName: undefined,
      trademarkRegistration: undefined,
      swornStatement: true,
      penaltyAcknowledged: true,
    });
    // Se guardan tal como se escribieron (una por renglón).
    expect(parsed.urls).toEqual([
      "https://www.speeaking.com/p/0192f0c4-7b1a-7c3e-9d2f-1a2b3c4d5e6f",
      "https://otro.example/x",
    ]);
  });

  it("las dos casillas son obligatorias y nunca vienen marcadas", () => {
    const result = errors({ ...VALID, swornStatement: undefined, penaltyAcknowledged: null });
    expect(result.swornStatement?.[0]).toMatch(/bajo protesta de decir verdad/);
    expect(result.penaltyAcknowledged?.[0]).toMatch(/multa/);
  });

  it("exige el mínimo de la ley: nombre, contacto, contenido, derecho y dirección", () => {
    const result = errors({
      ...VALID,
      claimantName: " ",
      claimantEmail: "no-es-correo",
      workDescription: "foto",
      rightDescription: "",
      urls: "",
    });
    expect(Object.keys(result).sort()).toEqual([
      "claimantEmail",
      "claimantName",
      "rightDescription",
      "urls",
      "workDescription",
    ]);
  });

  it("el domicilio y los hechos se piden, pero un aviso sin ellos no se detiene", () => {
    // RLFDA art. 37 Quáter los pide; la ley (art. 114 Octies) no los exige para retirar.
    const parsed = noticeInputSchema.parse({ ...VALID, claimantDomicile: " ", facts: "" });
    expect(parsed.claimantDomicile).toBeUndefined();
    expect(parsed.facts).toBeUndefined();
    const { claimantDomicile: _domicile, facts: _facts, ...withoutThem } = VALID;
    expect(errors(withoutThem)).toEqual({});
    expect(errors({ ...VALID, claimantDomicile: "x".repeat(501) }).claimantDomicile).toBeDefined();
  });

  it("el teléfono y el correo alterno son opcionales, pero si vienen deben ser válidos", () => {
    expect(errors({ ...VALID, claimantPhone: "+52 55 1234 5678" })).toEqual({});
    expect(errors({ ...VALID, claimantAltEmail: "legal@estudioluz.mx" })).toEqual({});
    expect(errors({ ...VALID, claimantPhone: "llámame" }).claimantPhone).toBeDefined();
    expect(errors({ ...VALID, claimantAltEmail: "x@" }).claimantAltEmail).toBeDefined();
  });

  it("quien representa da el nombre de quien es titular", () => {
    expect(errors({ ...VALID, claimantRole: "REPRESENTATIVE" }).principalName?.[0]).toMatch(
      /titular/,
    );
    expect(
      errors({ ...VALID, claimantRole: "REPRESENTATIVE", principalName: "Luz Pérez Gómez" }),
    ).toEqual({});
  });

  it("las marcas exigen su número de registro en el IMPI", () => {
    expect(errors({ ...VALID, kind: "TRADEMARK" }).trademarkRegistration?.[0]).toMatch(/IMPI/);
    expect(errors({ ...VALID, kind: "TRADEMARK", trademarkRegistration: "1234567" })).toEqual({});
    expect(
      errors({ ...VALID, kind: "TRADEMARK", trademarkRegistration: "<script>" }),
    ).toHaveProperty("trademarkRegistration");
    // En derechos de autor no se pide registro (RLFDA art. 37 Quinquies) y no se guarda.
    expect(
      noticeInputSchema.parse({ ...VALID, trademarkRegistration: "1234567" }).trademarkRegistration,
    ).toBeUndefined();
  });

  it("de 1 a 20 direcciones válidas, una por renglón", () => {
    expect(errors({ ...VALID, urls: " \n " }).urls?.[0]).toMatch(/al menos una/);
    expect(errors({ ...VALID, urls: "javascript:alert(1)" }).urls?.[0]).toMatch(/no es válida/);
    const many = Array.from({ length: 21 }, (_, i) => `https://otro.example/${i}`).join("\n");
    expect(errors({ ...VALID, urls: many }).urls?.[0]).toMatch(/20/);
    const twenty = Array.from({ length: 20 }, (_, i) => `https://otro.example/${i}`).join("\n");
    expect(errors({ ...VALID, urls: twenty })).toEqual({});
  });

  it("un tipo de derecho o una calidad inventados no pasan", () => {
    expect(errors({ ...VALID, kind: "PATENT" }).kind).toBeDefined();
    expect(errors({ ...VALID, claimantRole: "FAN" }).claimantRole).toBeDefined();
  });
});

describe("contra-aviso", () => {
  const COUNTER = {
    caseNumber: "DA-000123",
    name: "Ana Torres",
    email: "ana@example.com",
    domicile: "Calle 5 de Mayo 20, Centro, 68000, Oaxaca, Oax.",
    basis: "OWN_WORK",
    explanation: "La foto la tomé yo en Bacalar en 2023; tengo el archivo original con sus datos.",
    swornStatement: "on",
    penaltyAcknowledged: "on",
  };

  it("acepta uno completo y lee el número de caso", () => {
    expect(counterNoticeInputSchema.parse(COUNTER)).toMatchObject({
      caseNumber: 123,
      basis: "OWN_WORK",
      swornStatement: true,
      penaltyAcknowledged: true,
    });
  });

  it("exige domicilio, fundamento, explicación y las dos casillas", () => {
    const parsed = counterNoticeInputSchema.safeParse({
      ...COUNTER,
      domicile: "",
      basis: "PORQUE_SI",
      explanation: "es mía",
      swornStatement: undefined,
      penaltyAcknowledged: undefined,
    });
    expect(parsed.success).toBe(false);
    expect(Object.keys(z.flattenError(parsed.error!).fieldErrors).sort()).toEqual([
      "basis",
      "domicile",
      "explanation",
      "penaltyAcknowledged",
      "swornStatement",
    ]);
  });

  it("un número de caso que no es de un aviso no pasa", () => {
    expect(counterNoticeInputSchema.safeParse({ ...COUNTER, caseNumber: "123" }).success).toBe(
      false,
    );
  });
});

describe("acciones del equipo", () => {
  const noticeId = "0192f0c4-7b1a-7c3e-9d2f-1a2b3c4d5e6f";

  it("mantener retirado y rechazar exigen una nota", () => {
    for (const action of ["keep_down", "reject"]) {
      expect(rightsAdminActionSchema.safeParse({ action, noticeId }).success).toBe(false);
      expect(rightsAdminActionSchema.safeParse({ action, noticeId, note: "  " }).success).toBe(
        false,
      );
      expect(
        rightsAdminActionSchema.safeParse({ action, noticeId, note: "Acreditó demanda." }).success,
      ).toBe(true);
    }
  });

  it("retirar (y volver a retirar) registra si el equipo ya retiró a mano lo que no se oculta solo", () => {
    expect(rightsAdminActionSchema.parse({ action: "remove", noticeId })).toMatchObject({
      manualDone: false,
    });
    expect(
      rightsAdminActionSchema.parse({ action: "remove", noticeId, manualDone: "on" }),
    ).toMatchObject({ manualDone: true });
    expect(
      rightsAdminActionSchema.parse({
        action: "keep_down",
        noticeId,
        note: "Acreditó demanda.",
        manualDone: "on",
      }),
    ).toMatchObject({ manualDone: true });
    expect(
      rightsAdminActionSchema.parse({ action: "keep_down", noticeId, note: "Acreditó demanda." }),
    ).toMatchObject({ manualDone: false });
  });

  it("una acción desconocida o sin caso no pasa", () => {
    expect(rightsAdminActionSchema.safeParse({ action: "delete", noticeId }).success).toBe(false);
    expect(rightsAdminActionSchema.safeParse({ action: "remove", noticeId: "x" }).success).toBe(
      false,
    );
  });
});
