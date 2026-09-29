import { describe, expect, it } from "vitest";
import {
  cleanMessageBody,
  conversationPair,
  hasUnread,
  looksLikePaymentData,
  MAX_MESSAGE_LENGTH,
  sideOf,
} from "./pair";

describe("mensajes privados (ADR-047): reglas puras", () => {
  it("el par va en orden fijo: una sola conversación por dos personas", () => {
    expect(conversationPair("b", "a")).toEqual({ userAId: "a", userBId: "b" });
    expect(conversationPair("a", "b")).toEqual(conversationPair("b", "a"));
  });

  it("sabe quién es la otra persona y cuándo leí yo", () => {
    const conversation = {
      userAId: "a",
      userBId: "b",
      aReadAt: new Date("2026-09-30T10:00:00Z"),
      bReadAt: null,
    };
    expect(sideOf(conversation, "a")).toMatchObject({ otherUserId: "b", readField: "aReadAt" });
    expect(sideOf(conversation, "b")).toMatchObject({
      otherUserId: "a",
      myReadAt: null,
      readField: "bReadAt",
    });
  });

  it("no leído solo si el último mensaje es del otro y llegó después de mi lectura", () => {
    const at = new Date("2026-09-30T12:00:00Z");
    expect(hasUnread(at, "b", "a", null)).toBe(true);
    expect(hasUnread(at, "b", "a", new Date("2026-09-30T11:00:00Z"))).toBe(true);
    expect(hasUnread(at, "b", "a", new Date("2026-09-30T12:00:00Z"))).toBe(false);
    expect(hasUnread(at, "a", "a", null)).toBe(false);
    expect(hasUnread(at, null, "a", null)).toBe(false);
  });

  it("limpia el texto y rechaza vacío o demasiado largo", () => {
    expect(cleanMessageBody("  hola \r\n\r\n\r\n\r\n¿qué tal?  ")).toBe("hola\n\n¿qué tal?");
    expect(cleanMessageBody("   \n  ")).toBeNull();
    expect(cleanMessageBody("x".repeat(MAX_MESSAGE_LENGTH + 1))).toBeNull();
    expect(cleanMessageBody("x".repeat(MAX_MESSAGE_LENGTH))).toHaveLength(MAX_MESSAGE_LENGTH);
  });

  it("detecta datos de pago para recordar la regla del pedido", () => {
    expect(looksLikePaymentData("Deposita a la CLABE 012345678901234567")).toBe(true);
    expect(looksLikePaymentData("mi tarjeta es 4111 1111 1111 1111")).toBe(true);
    expect(looksLikePaymentData("¿Sigue disponible la blusa?")).toBe(false);
  });
});
