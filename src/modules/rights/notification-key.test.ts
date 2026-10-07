import { describe, expect, it } from "vitest";
import {
  parseRightsNotificationKey,
  rightsNotificationKey,
  rightsSubject,
} from "./notification-key";

const RECIPIENT = "0192f0c4-7b1a-7c3e-9d2f-1a2b3c4d5e6f";

describe("aviso de contenido retirado o restaurado", () => {
  it("la llave guarda el caso, qué pasó, qué era y qué derecho, y se lee de vuelta", () => {
    const key = rightsNotificationKey({
      caseNumber: 123,
      event: "removed",
      subject: "PRODUCT",
      kind: "TRADEMARK",
      recipientId: RECIPIENT,
    });
    expect(key).toBe(`rights:123:removed:product:trademark:${RECIPIENT}`);
    expect(parseRightsNotificationKey(key)).toEqual({
      caseNumber: 123,
      event: "removed",
      subject: "PRODUCT",
      kind: "TRADEMARK",
    });
  });

  it("también guarda cuando el contenido se mantiene retirado por una acción legal", () => {
    const key = rightsNotificationKey({
      caseNumber: 5,
      event: "kept",
      subject: "POST",
      kind: "COPYRIGHT",
      recipientId: RECIPIENT,
    });
    expect(parseRightsNotificationKey(key)).toEqual({
      caseNumber: 5,
      event: "kept",
      subject: "POST",
      kind: "COPYRIGHT",
    });
  });

  it("una llave de otro aviso o malformada no se confunde", () => {
    for (const key of [
      null,
      "",
      `reaction:${RECIPIENT}:${RECIPIENT}`,
      `rights:abc:removed:post:copyright:${RECIPIENT}`,
      `rights:12:hidden:post:copyright:${RECIPIENT}`,
      `rights:12:removed:story:copyright:${RECIPIENT}`,
      `rights:12:removed:post:patent:${RECIPIENT}`,
    ]) {
      expect(parseRightsNotificationKey(key)).toBeNull();
    }
  });

  it("dice «publicación» o «producto» solo si todo lo de esa persona es de ese tipo", () => {
    expect(rightsSubject(["POST", "POST"])).toBe("POST");
    expect(rightsSubject(["PRODUCT"])).toBe("PRODUCT");
    expect(rightsSubject(["POST", "PRODUCT"])).toBe("CONTENT");
    expect(rightsSubject(["USER"])).toBe("CONTENT");
    expect(rightsSubject([])).toBe("CONTENT");
  });
});
