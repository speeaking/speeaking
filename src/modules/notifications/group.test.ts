import { describe, expect, it } from "vitest";
import {
  actorNames,
  excerpt,
  groupNotifications,
  type NotificationRow,
  notificationSentence,
} from "./group";

const person = (name: string) => ({
  username: name.toLowerCase(),
  displayName: name,
  avatarUrl: null,
});

let sequence = 0;
function row(overrides: Partial<NotificationRow>): NotificationRow {
  sequence += 1;
  return {
    id: `n${sequence}`,
    type: "REACTION",
    createdAt: new Date("2026-10-01T15:00:00Z"),
    readAt: null,
    actor: person("Ana"),
    postId: "post-1",
    postExcerpt: "Mi cocina nueva",
    commentExcerpt: null,
    reaction: "LIKE",
    orderId: null,
    orderTitle: null,
    ...overrides,
  };
}

describe("groupNotifications (ADR-059)", () => {
  it("junta las reacciones de una publicación, sin repetir personas y con sus emojis", () => {
    const items = groupNotifications(
      [
        row({
          actor: person("Ana"),
          reaction: "LIKE",
          createdAt: new Date("2026-10-01T15:00:00Z"),
        }),
        row({
          actor: person("Luis"),
          reaction: "HAHA",
          createdAt: new Date("2026-10-01T16:00:00Z"),
        }),
        row({ actor: person("Ana"), reaction: "WOW", createdAt: new Date("2026-10-01T14:00:00Z") }),
      ],
      "yo",
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: "REACTION",
      actors: [person("Luis"), person("Ana")],
      reactions: ["HAHA", "LIKE", "WOW"],
      unread: true,
      href: "/p/post-1",
    });
  });

  it("los comentarios llevan al panel de comentarios y citan el más reciente", () => {
    const [item] = groupNotifications(
      [
        row({
          type: "COMMENT",
          commentExcerpt: "Primero",
          createdAt: new Date("2026-10-01T10:00:00Z"),
        }),
        row({
          type: "COMMENT",
          commentExcerpt: "¡Qué bonita!",
          createdAt: new Date("2026-10-01T12:00:00Z"),
        }),
      ],
      "yo",
    );

    expect(item).toMatchObject({ commentExcerpt: "¡Qué bonita!", href: "/p/post-1/comentarios" });
  });

  it("los seguidores del mismo día van juntos; uno solo lleva a su perfil", () => {
    const items = groupNotifications(
      [
        row({
          type: "FOLLOW",
          actor: person("Mar"),
          postId: null,
          createdAt: new Date("2026-10-01T15:00:00Z"),
        }),
        row({
          type: "FOLLOW",
          actor: person("Sol"),
          postId: null,
          createdAt: new Date("2026-10-01T16:00:00Z"),
        }),
        row({
          type: "FOLLOW",
          actor: person("Leo"),
          postId: null,
          createdAt: new Date("2026-09-28T16:00:00Z"),
        }),
      ],
      "yo",
    );

    expect(items.map((item) => [item.actors.length, item.href])).toEqual([
      [2, "/u/yo/seguidores"],
      [1, "/u/leo"],
    ]);
  });

  it("un grupo está leído solo si todos sus avisos lo están; los pedidos van solos", () => {
    const read = new Date("2026-10-01T17:00:00Z");
    const items = groupNotifications(
      [
        row({ readAt: read }),
        row({ readAt: read, actor: person("Luis") }),
        row({ type: "ORDER_PAID", actor: null, postId: null, orderId: "o1", orderTitle: "Camisa" }),
        row({
          type: "ORDER_SHIPPED",
          actor: null,
          postId: null,
          orderId: "o2",
          orderTitle: "Tenis",
        }),
      ],
      "yo",
    );

    expect(items.find((item) => item.type === "REACTION")?.unread).toBe(false);
    expect(items.find((item) => item.type === "ORDER_PAID")?.href).toBe("/studio/pedidos");
    expect(items.find((item) => item.type === "ORDER_SHIPPED")?.href).toBe("/pedidos/o2");
  });
});

describe("avisos de colaboraciones (ADR-063)", () => {
  it("a la tienda: quién etiquetó su producto, y la lleva a su panel de colaboraciones", () => {
    const [item] = groupNotifications(
      [row({ type: "PRODUCT_TAGGED", reaction: null, actor: person("Ana") })],
      "tienda",
    );

    expect(item!.href).toBe("/studio/colaboraciones");
    expect(notificationSentence(item!)).toEqual({
      who: "Ana",
      what: "etiquetó uno de tus productos en una publicación",
    });
  });

  it("a quien publicó: la tienda quitó la etiqueta, y lo lleva a su publicación", () => {
    const [item] = groupNotifications(
      [row({ type: "PRODUCT_TAG_REMOVED", reaction: null, actor: person("Ropero") })],
      "ana",
    );

    expect(item!.href).toBe("/p/post-1");
    expect(notificationSentence(item!)).toEqual({
      who: "Ropero",
      what: "quitó la etiqueta de su producto de tu publicación",
    });
  });
});

describe("avisos de derechos (ADR-076)", () => {
  const removed = (overrides: Partial<NotificationRow> = {}) =>
    row({
      type: "CONTENT_REMOVED",
      actor: null,
      reaction: null,
      postId: null,
      postExcerpt: null,
      rightsCase: { caseNumber: 123, subject: "POST", kind: "COPYRIGHT" },
      ...overrides,
    });

  it("dice qué se retiró, por qué aviso y que se puede mandar un contra-aviso", () => {
    const [item] = groupNotifications([removed()], "ana");

    expect(item!.href).toBe("/derechos-de-autor/contra-aviso?caso=DA-000123");
    expect(notificationSentence(item!)).toEqual({
      who: null,
      what: "Retiramos tu publicación por un aviso de derechos de autor (caso DA-000123). Puedes mandar un contra-aviso.",
    });
  });

  it("nombra el producto, la marca o la imagen de artista según el caso", () => {
    const [product] = groupNotifications(
      [removed({ rightsCase: { caseNumber: 7, subject: "PRODUCT", kind: "TRADEMARK" } })],
      "ana",
    );
    expect(notificationSentence(product!).what).toBe(
      "Retiramos tu producto por un aviso de marca (caso DA-000007). Puedes mandar un contra-aviso.",
    );
    const [other] = groupNotifications(
      [removed({ rightsCase: { caseNumber: 8, subject: "CONTENT", kind: "PERFORMER_IMAGE" } })],
      "ana",
    );
    expect(notificationSentence(other!).what).toBe(
      "Retiramos tu contenido por un aviso sobre la imagen o la voz de una persona artista (caso DA-000008). Puedes mandar un contra-aviso.",
    );
  });

  it("al restaurar avisa que volvió a mostrarse", () => {
    const [item] = groupNotifications([removed({ type: "CONTENT_RESTORED" })], "ana");

    expect(item!.href).toBe("/derechos-de-autor/contra-aviso?caso=DA-000123");
    expect(notificationSentence(item!)).toEqual({
      who: null,
      what: "Volvimos a mostrar tu publicación (caso DA-000123).",
    });
  });

  it("si se mantiene retirado por una acción legal lo dice, sin ofrecer otro contra-aviso", () => {
    const [item] = groupNotifications(
      [
        removed({
          rightsCase: { caseNumber: 123, subject: "POST", kind: "COPYRIGHT", event: "kept" },
        }),
      ],
      "ana",
    );
    expect(item!.href).toBe("/derechos-de-autor/contra-aviso?caso=DA-000123");
    expect(notificationSentence(item!).what).toBe(
      "Tu publicación queda retirada (caso DA-000123): quien avisó comprobó que inició una acción legal.",
    );
    const [product] = groupNotifications(
      [
        removed({
          rightsCase: { caseNumber: 9, subject: "PRODUCT", kind: "TRADEMARK", event: "kept" },
        }),
      ],
      "ana",
    );
    expect(notificationSentence(product!).what).toBe(
      "Tu producto queda retirado (caso DA-000009): quien avisó comprobó que inició una acción legal.",
    );
  });

  it("cada aviso va solo, aunque sean del mismo día", () => {
    const items = groupNotifications(
      [
        removed(),
        removed({ rightsCase: { caseNumber: 124, subject: "POST", kind: "COPYRIGHT" } }),
        removed({ type: "CONTENT_RESTORED" }),
      ],
      "ana",
    );
    expect(items).toHaveLength(3);
  });

  it("sin el caso (llave dañada) lleva a la explicación y no inventa un número", () => {
    const [item] = groupNotifications([removed({ rightsCase: null })], "ana");

    expect(item!.href).toBe("/derechos-de-autor#contra-aviso");
    expect(notificationSentence(item!).what).toBe(
      "Retiramos tu contenido por un aviso de derechos. Puedes mandar un contra-aviso.",
    );
  });
});

describe("textos de los avisos", () => {
  it("nombres como Facebook: uno, dos, o dos y cuántas personas más", () => {
    expect(actorNames([person("Ana")])).toBe("Ana");
    expect(actorNames([person("Ana"), person("Luis")])).toBe("Ana y Luis");
    expect(actorNames([person("Ana"), person("Luis"), person("Mar")])).toBe(
      "Ana, Luis y 1 persona más",
    );
    expect(actorNames([person("Ana"), person("Luis"), person("Mar"), person("Sol")])).toBe(
      "Ana, Luis y 2 personas más",
    );
  });

  it("la frase concuerda en singular y plural", () => {
    const [one] = groupNotifications([row({})], "yo");
    expect(notificationSentence(one!)).toEqual({
      who: "Ana",
      what: "reaccionó a tu publicación",
    });
    const [many] = groupNotifications([row({}), row({ actor: person("Luis") })], "yo");
    expect(notificationSentence(many!).what).toBe("reaccionaron a tu publicación");
  });

  it("excerpt corta en limpio con «…»", () => {
    expect(excerpt("  Hola   mundo ")).toBe("Hola mundo");
    expect(excerpt("a".repeat(100), 10)).toBe("aaaaaaaaa…");
    expect(excerpt(null)).toBeNull();
  });
});
