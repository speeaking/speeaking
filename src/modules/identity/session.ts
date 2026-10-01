import "server-only";
import type { Route } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { UserRole } from "@/generated/prisma/enums";
import { countUnreadConversations } from "@/modules/messages/service";
import { countUnreadNotifications } from "@/modules/notifications/queries";
import { getUnreadCounts } from "@/modules/social/unread";
import { VISIBLE_PRODUCT } from "@/modules/trust/visibility";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import type { NavCommunities, ViewerSummary } from "./viewer-summary";

/**
 * Tope absoluto de una sesión (SEC-10): Better Auth la renueva mientras se use (30 días deslizantes),
 * así que una sesión robada no vencería nunca. A los 90 días de iniciada hay que volver a entrar.
 */
export const MAX_SESSION_AGE_MS = 90 * 24 * 60 * 60 * 1000;

/** Sesión actual (una sola consulta por request gracias a `cache`). `null` si pasó el tope. */
export const getSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  if (Date.now() - new Date(session.session.createdAt).getTime() < MAX_SESSION_AGE_MS) {
    return session;
  }
  // Se borra para que tampoco sirva en `auth.api.*` ni en otra petición.
  await db.session.deleteMany({ where: { id: session.session.id } });
  return null;
});

export type Viewer = {
  userId: string;
  name: string;
  email: string;
  profile: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
    onboarded: boolean;
    personalizationEnabled: boolean;
    /** Rol de equipo (solo servidor). Para exigirlo usa `requireAdmin` (src/modules/admin/guard.ts). */
    role: UserRole;
  } | null;
  sellerProfileId: string | null;
};

/** Persona que ve la página, con lo mínimo para decidir navegación. `null` si no hay sesión. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await getSession();
  if (!session) return null;
  const [profile, seller] = await Promise.all([
    db.profile.findUnique({
      where: { userId: session.user.id },
      select: {
        username: true,
        displayName: true,
        avatarUrl: true,
        onboardedAt: true,
        personalizationEnabled: true,
        role: true,
      },
    }),
    db.sellerProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } }),
  ]);
  return {
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
    profile: profile
      ? {
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          onboarded: profile.onboardedAt !== null,
          personalizationEnabled: profile.personalizationEnabled,
          role: profile.role,
        }
      : null,
    sellerProfileId: seller?.id ?? null,
  };
});

/** Máximo de comunidades propias en la navegación («Tus comunidades»). */
const NAV_COMMUNITIES = 8;
/** Comunidades sugeridas en la columna izquierda («Para descubrir»). */
const NAV_SUGGESTIONS = 3;

const navCommunitySelect = { id: true, slug: true, name: true, emoji: true, hue: true } as const;

/**
 * Comunidades de una persona, las más recientes primero. Son pocas (hay una docena), así que se
 * traen todas una sola vez por request: sirven para «Tus comunidades» y para no sugerir las suyas.
 */
const getMemberships = cache(async (userId: string) =>
  db.communityMembership.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { community: { select: navCommunitySelect } },
  }),
);

/**
 * Resumen seguro para el cliente (navegación). Una sola vez por request gracias a `cache`. Las
 * novedades por comunidad comparten consulta con las burbujas del inicio (`getUnreadCounts`).
 */
export const getViewerSummary = cache(async (): Promise<ViewerSummary> => {
  const viewer = await getViewer();
  if (!viewer) return null;
  const [cart, memberships, unread, unreadMessages, unreadNotifications] = await Promise.all([
    // El mismo número que `cartCount` (commerce/cart.ts) y que las líneas de /carrito: sin las
    // piezas de productos ocultos por moderación (P14), que el carrito omite.
    db.cartItem.aggregate({
      where: { cart: { userId: viewer.userId }, product: VISIBLE_PRODUCT },
      _sum: { quantity: true },
    }),
    getMemberships(viewer.userId),
    getUnreadCounts(viewer.userId),
    countUnreadConversations(viewer.userId).catch(() => 0),
    countUnreadNotifications(viewer.userId).catch(() => 0),
  ]);
  return {
    cartCount: cart._sum.quantity ?? 0,
    unreadMessages,
    unreadNotifications,
    username: viewer.profile?.username ?? null,
    displayName: viewer.profile?.displayName ?? viewer.name,
    avatarUrl: viewer.profile?.avatarUrl ?? null,
    isSeller: viewer.sellerProfileId !== null,
    onboarded: viewer.profile?.onboarded ?? false,
    // Solo si es ADMIN: a nadie más le llega ni la llave (el área de administración no se anuncia).
    ...(viewer.profile?.role === "ADMIN" ? { isAdmin: true as const } : {}),
    communities: memberships.slice(0, NAV_COMMUNITIES).map(({ community }) => ({
      slug: community.slug,
      name: community.name,
      emoji: community.emoji,
      hue: community.hue,
      ...(unread[community.id] ? { unread: unread[community.id] } : {}),
    })),
  };
});

/** IDs de las comunidades de quien navega (vacío sin sesión), p. ej. para pintar «Unirme». */
export const getJoinedCommunityIds = cache(async (): Promise<Set<string>> => {
  const viewer = await getViewer();
  if (!viewer) return new Set();
  const memberships = await getMemberships(viewer.userId);
  return new Set(memberships.map(({ community }) => community.id));
});

/**
 * Comunidades de la columna izquierda: con sesión, hasta 3 a las que aún no se une (en el orden
 * curado); sin sesión, todas. Solo datos públicos de la comunidad.
 */
export const getNavCommunities = cache(async (): Promise<NavCommunities> => {
  const [viewer, all, joined] = await Promise.all([
    getViewer(),
    db.community.findMany({ orderBy: { sortOrder: "asc" }, select: navCommunitySelect }),
    getJoinedCommunityIds(),
  ]);
  if (!viewer) return { total: all.length, items: all };
  return {
    total: all.length,
    items: all.filter((community) => !joined.has(community.id)).slice(0, NAV_SUGGESTIONS),
  };
});

/** Exige sesión; si no hay, manda a iniciar sesión y regresa a `returnTo` después. */
export async function requireViewer(returnTo: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) {
    redirect(`/entrar?next=${encodeURIComponent(returnTo)}` as Route);
  }
  return viewer;
}

/** Exige sesión y onboarding completo. */
export async function requireOnboardedViewer(returnTo: string) {
  const viewer = await requireViewer(returnTo);
  if (!viewer.profile?.onboarded) {
    redirect("/bienvenida");
  }
  return viewer as Viewer & { profile: NonNullable<Viewer["profile"]> };
}
