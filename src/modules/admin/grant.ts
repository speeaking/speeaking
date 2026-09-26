import { z } from "zod";
import type { UserRole } from "@/generated/prisma/enums";
import type { Database } from "@/server/db-client";

/**
 * Lógica de `scripts/make-admin.ts`: dar o quitar el rol ADMIN desde la terminal. Es el ÚNICO camino
 * que escribe `Profile.role` (ninguna acción ni formulario lo expone). Sin `server-only` ni
 * `@/server/db`: corre fuera de Next y recibe la base como parámetro.
 */

export const MAKE_ADMIN_USAGE = "Uso: pnpm make-admin <correo> [--revoke] [--allow-production]";

/** Error con mensaje listo para la terminal (en español, sin datos de otras cuentas). */
export class MakeAdminError extends Error {
  override name = "MakeAdminError";
}

export type MakeAdminArgs = {
  email: string;
  /** Quitar el rol (vuelve a USER) en lugar de darlo. */
  revoke: boolean;
  /** Permitir una base de producción: decisión explícita, nunca por omisión. */
  allowProduction: boolean;
};

const emailSchema = z.email();
const FLAGS = new Set(["--revoke", "--allow-production"]);

/** Lee los argumentos (sin `node` ni el script). Exactamente un correo; banderas conocidas. */
export function parseMakeAdminArgs(argv: readonly string[]): MakeAdminArgs {
  const flags = argv.filter((arg) => arg.startsWith("--"));
  const positional = argv.filter((arg) => !arg.startsWith("--"));
  const unknown = flags.filter((flag) => !FLAGS.has(flag));
  if (unknown.length > 0) {
    throw new MakeAdminError(`Opción desconocida: ${unknown.join(", ")}.\n${MAKE_ADMIN_USAGE}`);
  }
  if (positional.length !== 1) {
    throw new MakeAdminError(`Indica exactamente un correo.\n${MAKE_ADMIN_USAGE}`);
  }
  const email = positional[0]!.trim().toLowerCase();
  if (!emailSchema.safeParse(email).success) {
    throw new MakeAdminError(`Correo inválido.\n${MAKE_ADMIN_USAGE}`);
  }
  return {
    email,
    revoke: flags.includes("--revoke"),
    allowProduction: flags.includes("--allow-production"),
  };
}

/**
 * ¿La base parece de producción? Con `NODE_ENV=production` o un servidor que no es esta máquina
 * (Neon, etc.). Una URL que no se puede leer cuenta como producción (falla cerrada).
 */
export function isProductionTarget(env: { NODE_ENV?: string; DATABASE_URL?: string }): boolean {
  if (env.NODE_ENV === "production") return true;
  if (!env.DATABASE_URL || !URL.canParse(env.DATABASE_URL)) return true;
  const { hostname } = new URL(env.DATABASE_URL);
  return !(
    hostname === "localhost" ||
    hostname === "[::1]" ||
    /^127(\.\d{1,3}){3}$/.test(hostname)
  );
}

/** Se niega a tocar producción sin `--allow-production`. */
export function assertMakeAdminAllowed(
  env: { NODE_ENV?: string; DATABASE_URL?: string },
  args: Pick<MakeAdminArgs, "allowProduction">,
) {
  if (isProductionTarget(env) && !args.allowProduction) {
    throw new MakeAdminError(
      "La base de datos parece de producción (NODE_ENV=production o un servidor remoto). " +
        "Si de verdad quieres cambiar un rol ahí, repite el comando con --allow-production.",
    );
  }
}

export type RoleChange = {
  userId: string;
  username: string;
  previousRole: UserRole;
  role: UserRole;
  /** false si ya tenía ese rol (el comando es idempotente). */
  changed: boolean;
};

/**
 * Cambia el rol de la cuenta con ese correo. Exige perfil (se crea al terminar la bienvenida):
 * sin perfil no hay dónde guardar el rol.
 */
export async function setUserRole(
  db: Database,
  { email, revoke }: Pick<MakeAdminArgs, "email" | "revoke">,
): Promise<RoleChange> {
  const role: UserRole = revoke ? "USER" : "ADMIN";
  const user = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, profile: { select: { username: true, role: true } } },
  });
  if (!user) {
    throw new MakeAdminError("No existe una cuenta con ese correo.");
  }
  if (!user.profile) {
    throw new MakeAdminError(
      "La cuenta existe pero no ha terminado la bienvenida (no tiene perfil). Termínala en la app y vuelve a correr el comando.",
    );
  }
  const previousRole = user.profile.role;
  if (previousRole !== role) {
    await db.profile.update({ where: { userId: user.id }, data: { role } });
  }
  return {
    userId: user.id,
    username: user.profile.username,
    previousRole,
    role,
    changed: previousRole !== role,
  };
}

/** Mensaje final para la terminal. */
export function describeRoleChange(change: RoleChange): string {
  const who = `@${change.username}`;
  if (!change.changed) {
    return change.role === "ADMIN"
      ? `${who} ya tenía el rol ADMIN. No se cambió nada.`
      : `${who} no tenía el rol ADMIN. No se cambió nada.`;
  }
  return change.role === "ADMIN"
    ? `✓ ${who} ahora es ADMIN: puede entrar a /admin (en su siguiente carga de página).`
    : `✓ ${who} ya no es ADMIN: /admin le responde 404 desde su siguiente carga de página.`;
}
