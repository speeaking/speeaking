import { siteConfig } from "@/config/site";
import type { FeedItemDTO, FeedMediaDTO } from "@/modules/feed/dto";

/** Textos y recortes del perfil (ADR-055). Código puro: sin IA, sin base de datos. */

const NAMES_SHOWN = 3;

function joinNames(names: readonly string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

/** «Entre quienes sigues: Ana, Luis y 3 más»: personas que sigues que también siguen este perfil. */
export function peopleInCommonText(names: readonly string[], total: number): string | null {
  if (total <= 0 || names.length === 0) return null;
  const shown = names.slice(0, NAMES_SHOWN);
  const rest = total - shown.length;
  const list = rest > 0 ? `${shown.join(", ")} y ${rest} más` : joinNames(shown);
  return `Entre quienes sigues: ${list}`;
}

/** «Comparten Gaming y Moda». */
export function communitiesInCommonText(names: readonly string[]): string | null {
  if (names.length === 0) return null;
  return `Comparten ${joinNames(names.slice(0, NAMES_SHOWN))}`;
}

const monthYear = new Intl.DateTimeFormat(siteConfig.locale, {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** «Desde septiembre de 2026». */
export function joinedText(date: Date): string {
  return `Desde ${monthYear.format(date)}`;
}

/** La portada del perfil: la primera foto de la publicación más reciente con fotos, o nada. */
export function profileCover(posts: readonly FeedItemDTO[]): FeedMediaDTO | null {
  return posts.find((post) => post.media.length > 0)?.media[0] ?? null;
}

export type ProfilePhoto = { postId: string; media: FeedMediaDTO };

/** Cuántas fotos trae la pestaña «Fotos» (de las publicaciones ya cargadas del perfil). */
export const PROFILE_PHOTOS_MAX = 30;

/** Las fotos de sus publicaciones, en orden de publicación, cada una con la publicación que abre. */
export function profilePhotos(
  posts: readonly FeedItemDTO[],
  max = PROFILE_PHOTOS_MAX,
): ProfilePhoto[] {
  return posts
    .flatMap((post) => post.media.map((media) => ({ postId: post.id, media })))
    .slice(0, max);
}

export type ProfileTab = "publicaciones" | "fotos" | "tienda";

/** Pestaña inicial por `?ver=`: «tienda» solo si hay productos; cualquier otra cosa, publicaciones. */
export function resolveProfileTab(
  ver: string | string[] | undefined,
  hasShop: boolean,
): ProfileTab {
  const value = Array.isArray(ver) ? ver[0] : ver;
  if (value === "fotos") return "fotos";
  if (value === "tienda" && hasShop) return "tienda";
  return "publicaciones";
}
