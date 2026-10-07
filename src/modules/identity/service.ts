import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { POST_WITH_VISIBLE_PRODUCT } from "@/modules/trust/visibility";
import { PUBLIC_POST } from "@/modules/relationships/privacy";
import { db } from "@/server/db";
import { MIN_VISIBLE_MEMBERS } from "./community-signal";
import { LEGAL_VERSIONS } from "./constants";
import { MIN_COMMUNITIES } from "./onboarding-options";
import { normalizeInterest, type OnboardingInput, suggestUsername } from "./onboarding-schema";

export class OnboardingError extends Error {
  override name = "OnboardingError";
  constructor(readonly code: "USERNAME_TAKEN" | "INVALID_COMMUNITIES") {
    super(code);
  }
}

/**
 * ¿La cuenta ya hizo lo que pide el registro: aceptar términos y aviso de privacidad y declarar 18
 * años o más (ADR-076)? Una cuenta creada con Google (ADR-049) no pasó por el registro: la
 * bienvenida le pide las casillas y lo registra al terminar. También a quien se registró con correo
 * antes de que existiera la casilla de edad y aún no termina la bienvenida.
 */
export async function hasLegalConsents(userId: string): Promise<boolean> {
  const rows = await db.userConsent.findMany({
    where: { userId, type: { in: ["TERMS", "PRIVACY_NOTICE", "AGE_18"] }, granted: true },
    distinct: ["type"],
    select: { type: true },
  });
  const types = new Set(rows.map((row) => row.type));
  return (types.has("TERMS") || types.has("PRIVACY_NOTICE")) && types.has("AGE_18");
}

/** Sugiere un nombre de usuario libre a partir del nombre (agrega números si está ocupado). */
export async function suggestAvailableUsername(name: string) {
  const base = suggestUsername(name).slice(0, 26);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}${Math.floor(10 + Math.random() * 90)}`;
    const taken = await db.profile.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return `${base}${Date.now().toString().slice(-4)}`;
}

/**
 * Completa el onboarding en una transacción: perfil, comunidades, marcas, intención de compra
 * declarada y consentimiento de personalización (historial versionado).
 * Devuelve los IDs de las comunidades nuevas para registrar eventos.
 */
export async function completeOnboarding(
  userId: string,
  input: OnboardingInput,
  options: { legalConsent?: boolean } = {},
) {
  const communities = await db.community.findMany({
    where: { slug: { in: input.communities }, removals: { none: { userId } } },
    select: { id: true },
  });
  if (communities.length < MIN_COMMUNITIES) {
    throw new OnboardingError("INVALID_COMMUNITIES");
  }

  const owner = await db.profile.findUnique({
    where: { username: input.username },
    select: { userId: true },
  });
  if (owner && owner.userId !== userId) {
    throw new OnboardingError("USERNAME_TAKEN");
  }

  try {
    return await db.$transaction(async (tx) => {
      // Mismo orden que el borrado de cuenta; une/sale/retira no pueden desajustar el contador.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      const communityIds = communities.map(({ id }) => id);
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM communities
        WHERE id IN (${Prisma.join(communityIds.map((id) => Prisma.sql`${id}::uuid`))})
        ORDER BY id FOR UPDATE
      `;
      if (
        locked.length !== communities.length ||
        (await tx.communityRemoval.count({ where: { userId, communityId: { in: communityIds } } }))
      ) {
        throw new OnboardingError("INVALID_COMMUNITIES");
      }
      const profileData = {
        username: input.username,
        displayName: input.displayName,
        goals: input.goals,
        personalizationEnabled: input.personalizationEnabled,
        onboardedAt: new Date(),
      };
      await tx.profile.upsert({
        where: { userId },
        create: { userId, ...profileData },
        update: profileData,
      });

      const existing = await tx.communityMembership.findMany({
        where: { userId },
        select: { communityId: true },
      });
      const already = new Set(existing.map((membership) => membership.communityId));
      const joined = communities.map(({ id }) => id).filter((id) => !already.has(id));
      if (joined.length > 0) {
        await tx.communityMembership.createMany({
          data: joined.map((communityId) => ({ userId, communityId })),
        });
        await tx.community.updateMany({
          where: { id: { in: joined } },
          data: { memberCount: { increment: 1 } },
        });
        await tx.communityInvitation.deleteMany({ where: { userId, communityId: { in: joined } } });
        await tx.notification.deleteMany({
          where: { recipientId: userId, communityId: { in: joined }, type: "COMMUNITY_INVITE" },
        });
      }

      if (input.brands.length > 0) {
        await tx.userInterest.createMany({
          data: input.brands.map((label) => ({
            userId,
            kind: "BRAND" as const,
            label,
            value: normalizeInterest(label),
          })),
          skipDuplicates: true,
        });
      }

      if (input.intentQuery) {
        await tx.shoppingIntent.create({
          data: {
            userId,
            query: input.intentQuery,
            budgetMaxCents: input.budgetMaxCents ?? null,
            source: "ONBOARDING",
            // La intención declarada pierde fuerza con el tiempo: vence en 30 días.
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      }

      await tx.userConsent.create({
        data: {
          userId,
          type: "PERSONALIZATION",
          version: LEGAL_VERSIONS.personalization,
          granted: input.personalizationEnabled,
        },
      });
      if (options.legalConsent) {
        // Cuenta creada con Google (ADR-049): aceptó términos y aviso y declaró 18 años o más aquí,
        // con las casillas (la edad, con la versión de los términos que la piden, como al registrarse).
        await tx.userConsent.createMany({
          data: [
            { userId, type: "TERMS", version: LEGAL_VERSIONS.terms, granted: true },
            {
              userId,
              type: "PRIVACY_NOTICE",
              version: LEGAL_VERSIONS.privacyNotice,
              granted: true,
            },
            { userId, type: "AGE_18", version: LEGAL_VERSIONS.terms, granted: true },
          ],
        });
      }

      return { joinedCommunityIds: joined };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new OnboardingError("USERNAME_TAKEN");
    }
    throw error;
  }
}

/**
 * Publicaciones visibles de las comunidades que todavía no muestran su número de miembros, en una
 * sola consulta agrupada (sin N+1). `communityId` → publicaciones. Visibles = publicadas y sin
 * producto o con su producto visible: las de un producto oculto por el equipo no cuentan (P14).
 */
export async function countPostsOfNewCommunities() {
  const rows = await db.post.groupBy({
    by: ["communityId"],
    where: {
      status: "PUBLISHED",
      community: { memberCount: { lt: MIN_VISIBLE_MEMBERS } },
      AND: [POST_WITH_VISIBLE_PRODUCT, PUBLIC_POST],
    },
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.communityId, row._count._all]));
}

/** Publicaciones visibles de una comunidad (sin las de productos ocultos por el equipo, P14). */
export function countCommunityPosts(communityId: string) {
  return db.post.count({
    where: { communityId, status: "PUBLISHED", AND: [POST_WITH_VISIBLE_PRODUCT, PUBLIC_POST] },
  });
}

/** Oficiales para bienvenida; también grupos propios al publicar, o todos al descubrir. */
export function listCommunities(options: { includeGroups?: boolean; userId?: string } = {}) {
  return db.community.findMany({
    where: options.includeGroups
      ? {}
      : {
          OR: [
            { isOfficial: true },
            ...(options.userId ? [{ memberships: { some: { userId: options.userId } } }] : []),
          ],
        },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      emoji: true,
      hue: true,
      description: true,
      memberCount: true,
      ownerId: true,
      isOfficial: true,
    },
  });
}
