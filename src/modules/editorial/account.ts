import { siteConfig } from "@/config/site";
import { Prisma } from "@/generated/prisma/client";
import type { Client } from "@/modules/platform/client";

/**
 * La cuenta editorial de una comunidad (ADR-018, ADR-066): «Equipo speeaking», identificada como
 * «Cuenta editorial» en su perfil y en cada publicación. Es de la plataforma: no tiene contraseña
 * (nadie puede iniciar sesión con ella), su correo usa el dominio reservado `.invalid` y su usuario
 * `equipo.<comunidad>` está reservado para que nadie más lo ocupe (`identity/reserved-names.ts`).
 *
 * Sin `server-only`: también la usa `prisma/seed.ts`.
 */
export function editorialAccount(community: { slug: string; name: string }) {
  return {
    email: `editorial.${community.slug}@speeaking.invalid`,
    username: `equipo.${community.slug}`,
    // La comunidad ya se muestra junto al autor, así que la cuenta se llama solo «Equipo speeaking».
    name: `Equipo ${siteConfig.name}`,
    bio: `Cuenta editorial de la comunidad ${community.name}. Contenido creado por el equipo con ayuda de IA.`,
  };
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * El correo de la cuenta editorial lo tiene una cuenta que NO es de la plataforma (una persona con
 * contraseña o con Google, o un perfil que no es editorial). No se publica con ella.
 */
export class EditorialAccountConflictError extends Error {
  override name = "EditorialAccountConflictError";
  constructor() {
    super("[redaccion] el correo de la cuenta editorial lo tiene otra cuenta");
  }
}

const accountCheck = {
  id: true,
  profile: { select: { isEditorial: true } },
  _count: { select: { accounts: true } },
} as const;

/** Una cuenta de la plataforma: perfil editorial y ninguna forma de iniciar sesión. */
function platformAccountId(user: {
  id: string;
  profile: { isEditorial: boolean } | null;
  _count: { accounts: number };
}) {
  if (!user.profile?.isEditorial || user._count.accounts > 0) {
    throw new EditorialAccountConflictError();
  }
  return user.id;
}

/**
 * Id de la cuenta editorial de la comunidad; la crea si aún no existe (en producción el seed no
 * crea contenido editorial). Si el correo ya lo tiene una cuenta que no es de la plataforma, lanza
 * `EditorialAccountConflictError` (nadie puede registrarse con un correo `.invalid`, pero no se
 * confía solo en eso). Llámala FUERA de una transacción: si dos personas publican a la vez el primer
 * borrador de una comunidad, la segunda creación choca y aquí se lee la que ganó.
 */
export async function ensureEditorialAccount(
  client: Client,
  community: { slug: string; name: string },
): Promise<string> {
  const account = editorialAccount(community);
  const existing = await client.user.findUnique({
    where: { email: account.email },
    select: accountCheck,
  });
  if (existing) return platformAccountId(existing);
  try {
    const created = await client.user.create({
      data: {
        email: account.email,
        name: account.name,
        emailVerified: true,
        profile: {
          create: {
            username: account.username,
            displayName: account.name,
            bio: account.bio,
            isEditorial: true,
            onboardedAt: new Date(),
          },
        },
      },
      select: { id: true },
    });
    return created.id;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const winner = await client.user.findUnique({
      where: { email: account.email },
      select: accountCheck,
    });
    // El correo no existe: lo que chocó fue el nombre de usuario, ocupado por otra cuenta.
    if (!winner) throw new EditorialAccountConflictError();
    return platformAccountId(winner);
  }
}
