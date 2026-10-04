import { siteConfig } from "@/config/site";

/**
 * Agrupar y redactar avisos (ADR-059). Código puro: lo usa la página de avisos y lo prueban las
 * pruebas unitarias sin base de datos.
 */

export type NotificationKind =
  | "REACTION"
  | "COMMENT"
  | "FOLLOW"
  | "FRIEND_REQUEST"
  | "FRIEND_ACCEPTED"
  | "ORDER_PAID"
  | "ORDER_SHIPPED"
  | "ORDER_DELIVERED"
  | "ORDER_CANCELLED"
  | "PRODUCT_TAGGED"
  | "PRODUCT_TAG_REMOVED";

export type NotificationActor = { username: string; displayName: string; avatarUrl: string | null };

/** Un aviso tal como sale de la base, ya con lo público de quién lo causó y de qué. */
export type NotificationRow = {
  id: string;
  type: NotificationKind;
  createdAt: Date;
  readAt: Date | null;
  actor: NotificationActor | null;
  postId: string | null;
  postExcerpt: string | null;
  commentExcerpt: string | null;
  /** Tipo de reacción (ADR-054), solo en REACTION. */
  reaction: string | null;
  orderId: string | null;
  orderTitle: string | null;
};

export type NotificationItem = {
  ids?: string[];
  key: string;
  type: NotificationKind;
  /** Quiénes, del más reciente al más antiguo y sin repetir. */
  actors: NotificationActor[];
  at: Date;
  unread: boolean;
  postExcerpt: string | null;
  /** El comentario más reciente del grupo. */
  commentExcerpt: string | null;
  /** Reacciones distintas del grupo (hasta 3), de la más reciente a la más antigua. */
  reactions: string[];
  orderTitle: string | null;
  href: string;
};

const dayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: siteConfig.timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function groupKey(row: NotificationRow) {
  switch (row.type) {
    case "REACTION":
      return `reaction:${row.postId}`;
    case "COMMENT":
      return `comment:${row.postId}`;
    // Los seguidores nuevos de un mismo día van juntos («Ana y 2 personas más»).
    case "FOLLOW":
      return `follow:${dayKey.format(row.createdAt)}`;
    default:
      return row.id;
  }
}

function hrefFor(
  type: NotificationKind,
  first: NotificationRow,
  actors: NotificationActor[],
  selfUsername: string,
) {
  switch (type) {
    case "REACTION":
      return `/p/${first.postId}`;
    case "COMMENT":
      return `/p/${first.postId}/comentarios`;
    case "FOLLOW":
      return actors.length === 1 ? `/u/${actors[0]!.username}` : `/u/${selfUsername}/seguidores`;
    case "FRIEND_REQUEST":
      return "/personas?ver=solicitudes";
    case "FRIEND_ACCEPTED":
      return actors[0] ? `/u/${actors[0].username}` : "/personas";
    case "ORDER_PAID":
      return "/studio/pedidos";
    // La tienda llega a su panel de colaboraciones (ahí puede quitar la etiqueta).
    case "PRODUCT_TAGGED":
      return "/studio/colaboraciones";
    case "PRODUCT_TAG_REMOVED":
      return `/p/${first.postId}`;
    default:
      return `/pedidos/${first.orderId}`;
  }
}

/**
 * Agrupa como Facebook: las reacciones y los comentarios de una misma publicación, y los seguidores
 * nuevos de un mismo día, en un solo aviso; los de pedidos van solos. Respeta el orden (lo más
 * reciente arriba) y un grupo está sin leer si alguno de sus avisos lo está.
 */
export function groupNotifications(
  rows: readonly NotificationRow[],
  selfUsername: string,
): NotificationItem[] {
  const sorted = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const groups = new Map<string, NotificationRow[]>();
  for (const row of sorted) {
    const key = groupKey(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.entries()].map(([key, group]) => {
    const first = group[0]!;
    const actors: NotificationActor[] = [];
    for (const row of group) {
      if (row.actor && !actors.some((actor) => actor.username === row.actor!.username)) {
        actors.push(row.actor);
      }
    }
    const reactions = [
      ...new Set(group.flatMap((row) => (row.reaction ? [row.reaction] : []))),
    ].slice(0, 3);
    return {
      key,
      ids: group.map((row) => row.id),
      type: first.type,
      actors,
      at: first.createdAt,
      unread: group.some((row) => row.readAt === null),
      postExcerpt: first.postExcerpt,
      commentExcerpt: group.find((row) => row.commentExcerpt)?.commentExcerpt ?? null,
      reactions,
      orderTitle: first.orderTitle,
      href: hrefFor(first.type, first, actors, selfUsername),
    };
  });
}

/** «Ana», «Ana y Luis», «Ana, Luis y 1 persona más», «Ana, Luis y 3 personas más». */
export function actorNames(actors: readonly NotificationActor[]): string {
  const [first, second] = actors;
  if (!first) return "Alguien";
  if (!second) return first.displayName;
  if (actors.length === 2) return `${first.displayName} y ${second.displayName}`;
  const rest = actors.length - 2;
  return `${first.displayName}, ${second.displayName} y ${rest} ${rest === 1 ? "persona más" : "personas más"}`;
}

/** Lo que pasó, en una frase: con quién al principio (en negritas en la interfaz) y qué después. */
export function notificationSentence(item: NotificationItem): { who: string | null; what: string } {
  const many = item.actors.length > 1;
  switch (item.type) {
    case "REACTION":
      return {
        who: actorNames(item.actors),
        what: many ? "reaccionaron a tu publicación" : "reaccionó a tu publicación",
      };
    case "COMMENT":
      return {
        who: actorNames(item.actors),
        what: many ? "comentaron tu publicación" : "comentó tu publicación",
      };
    case "FOLLOW":
      return {
        who: actorNames(item.actors),
        what: many ? "empezaron a seguirte" : "empezó a seguirte",
      };
    case "ORDER_PAID":
      return { who: null, what: "Tienes un pedido nuevo: prepara la entrega" };
    case "FRIEND_REQUEST":
      return { who: actorNames(item.actors), what: "te envió una solicitud de amistad" };
    case "FRIEND_ACCEPTED":
      return { who: actorNames(item.actors), what: "aceptó tu solicitud de amistad" };
    case "ORDER_SHIPPED":
      return { who: null, what: "Tu pedido va en camino" };
    case "ORDER_DELIVERED":
      return { who: null, what: "Tu pedido se entregó" };
    case "ORDER_CANCELLED":
      return { who: null, what: "La tienda canceló tu pedido" };
    case "PRODUCT_TAGGED":
      return {
        who: actorNames(item.actors),
        what: "etiquetó uno de tus productos en una publicación",
      };
    case "PRODUCT_TAG_REMOVED":
      return {
        who: actorNames(item.actors),
        what: "quitó la etiqueta de su producto de tu publicación",
      };
  }
}

/** Texto corto de una publicación o comentario para citarlo («…» al cortar). */
export function excerpt(text: string | null, max = 80): string | null {
  if (!text) return null;
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}
