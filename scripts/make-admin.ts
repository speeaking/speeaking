/**
 * Da (o quita) el rol ADMIN a una cuenta desde la terminal. Es el único camino que cambia
 * `Profile.role`: ninguna pantalla ni acción de la app lo expone.
 *
 * Uso:
 *   pnpm make-admin <correo>                      dar ADMIN
 *   pnpm make-admin <correo> --revoke             quitarlo (vuelve a USER)
 *   ... --allow-production                        permitir una base remota o NODE_ENV=production
 *
 * La cuenta debe haber terminado la bienvenida (el rol vive en su perfil). El cambio aplica en la
 * siguiente carga de página de esa persona (el rol se lee de la base en cada petición).
 */
import "dotenv/config";
import {
  assertMakeAdminAllowed,
  describeRoleChange,
  MakeAdminError,
  parseMakeAdminArgs,
  setUserRole,
} from "../src/modules/admin/grant";
import { createPrismaClient } from "../src/server/db-client";

async function main() {
  const args = parseMakeAdminArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new MakeAdminError("Falta DATABASE_URL.");
  assertMakeAdminAllowed(process.env, args);

  const db = createPrismaClient(databaseUrl);
  try {
    console.warn(describeRoleChange(await setUserRole(db, args)));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  // Los errores esperados se muestran sin pila; los demás, completos para diagnosticar.
  console.error(error instanceof MakeAdminError ? error.message : error);
  process.exitCode = 1;
});
