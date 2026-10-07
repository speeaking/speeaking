import { describe, expect, it } from "vitest";
import {
  contentKeptDownEmail,
  contentRemovedEmail,
  counterNoticeCopyEmail,
  noticeAcknowledgementEmail,
} from "./messages";

const at = new Date("2026-10-07T16:00:00Z");

describe("correos del aviso de derechos", () => {
  it("la copia del contra-aviso lleva nombre, contacto, domicilio y el plazo para acreditar", () => {
    const { subject, text } = counterNoticeCopyEmail({
      number: 123,
      counter: {
        name: "Ana Torres",
        email: "ana@example.com",
        domicile: "Calle 5 de Mayo 20, Oaxaca",
        basis: "LICENSE",
        explanation: "Tengo licencia del estudio desde 2025.",
        createdAt: at,
      },
      restoreDueAt: new Date("2026-10-21T16:00:00Z"),
    });

    expect(subject).toBe("Contra-aviso en tu caso DA-000123");
    for (const fragment of [
      "Nombre: Ana Torres",
      "Correo: ana@example.com",
      "Domicilio: Calle 5 de Mayo 20, Oaxaca",
      "Fundamento: Tengo licencia o permiso de quien es titular",
      "Tengo licencia del estudio desde 2025.",
      "21 de octubre de 2026",
      "dentro de los 15 días hábiles",
    ]) {
      expect(text).toContain(fragment);
    }
  });

  it("el acuse da el número de caso y avisa que el aviso no es anónimo", () => {
    const { subject, text } = noticeAcknowledgementEmail({
      numbers: [7],
      kind: "COPYRIGHT",
      receivedAt: at,
      urlCount: 2,
    });

    expect(subject).toBe("Recibimos tu aviso DA-000007");
    expect(text).toContain("Direcciones que señalaste: 2");
    expect(text).toContain("recibe tu nombre, tu correo y la descripción de tu aviso");
  });

  it("si lo señalado es de varias cuentas, el acuse da un número de caso por cada una", () => {
    const { subject, text } = noticeAcknowledgementEmail({
      numbers: [11, 12, 13],
      kind: "COPYRIGHT",
      receivedAt: at,
      urlCount: 5,
    });

    expect(subject).toBe("Recibimos tu aviso (casos DA-000011, DA-000012 y DA-000013)");
    expect(text).toContain(
      "lo subieron 3 cuentas distintas, así que abrimos un caso para cada una: DA-000011, DA-000012 y DA-000013",
    );
  });

  it("el acuse no repite nada de lo que escribió quien avisa (va a un correo sin verificar)", () => {
    // Si repitiera las direcciones, cualquiera podría usar el formulario para mandar enlaces a
    // un tercero desde nuestro remitente.
    const { text } = noticeAcknowledgementEmail({
      numbers: [8, 9],
      kind: "TRADEMARK",
      receivedAt: at,
      urlCount: 1,
    });
    expect(text).not.toMatch(/https?:\/\//);
  });

  it("a quien subió el contenido: qué se retiró, por qué aviso y dónde responder", () => {
    const { subject, text } = contentRemovedEmail({
      number: 9,
      kind: "TRADEMARK",
      subject: "PRODUCT",
      caseUrl: "https://www.speeaking.com/derechos-de-autor/contra-aviso?caso=DA-000009",
    });

    expect(subject).toBe("Retiramos tu producto (caso DA-000009)");
    expect(text).toContain("por un aviso de marca (caso DA-000009)");
    expect(text).toContain("contra-aviso?caso=DA-000009");
  });

  it("si se mantiene retirado: la acción legal acreditada y que lo resuelven las autoridades", () => {
    const { subject, text } = contentKeptDownEmail({
      number: 10,
      subject: "POST",
      caseUrl: "https://www.speeaking.com/derechos-de-autor/contra-aviso?caso=DA-000010",
    });

    expect(subject).toBe("Tu publicación queda retirada (caso DA-000010)");
    expect(text).toContain("comprobó que inició una acción legal");
    expect(text).toContain("contra-aviso?caso=DA-000010");
    expect(text).not.toContain("puedes mandar un contra-aviso");
  });
});
