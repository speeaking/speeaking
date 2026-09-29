/**
 * Build en Vercel (`vercel.json` → `buildCommand: "pnpm vercel-build"`; ADR-040, docs/deploy.md).
 *
 * 1. `prisma generate`. El cliente vive en `src/generated/` (fuera del repositorio); lo genera el
 *    `postinstall`, pero Vercel reutiliza su caché de dependencias y Prisma recomienda generarlo
 *    también en el build. Así nunca se compila con un cliente viejo o ausente.
 * 2. `next build`. Valida las variables de entorno: si falta algo, falla aquí. Hoy ninguna ruta
 *    prerenderizada lee la base (las estáticas son `/_global-error`, `/icon.svg` y
 *    `/manifest.webmanifest`); una que lo hiciera leería el esquema ANTERIOR (las migraciones van
 *    después) y haría fallar el build antes de migrar.
 * 3. SOLO en producción (`VERCEL_ENV=production`) y solo si el build pasó: `prisma migrate deploy`
 *    por la conexión DIRECTA de Neon (`DATABASE_URL_UNPOOLED`; Prisma Migrate no funciona por el
 *    pooler). Si una migración falla, el build falla y Vercel NO publica este despliegue: el anterior
 *    sigue atendiendo. `migrate deploy` solo aplica migraciones ya versionadas: nunca crea, resetea
 *    ni borra datos (`migrate dev`/`reset`/`db push` jamás corren aquí).
 *
 * Las vistas previas (Preview) nunca migran: no deben tocar la base de producción. Migrar al final
 * acorta la ventana en que el código anterior corre con el esquema nuevo (segundos, hasta que Vercel
 * promueve el despliegue); por eso cada migración debe ser compatible con el código anterior (agregar
 * primero, quitar en un despliegue posterior). Regresar a un despliegue anterior NO deshace
 * migraciones.
 *
 * Uso: lo corre Vercel. En local no hace falta (`pnpm build`; migraciones con `pnpm db:migrate`).
 */
import { spawnSync } from "node:child_process";

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/**
 * La cadena directa de Neon, revisada ANTES de compilar (falla rápido y sin mostrar su valor: lleva la
 * contraseña). Con pooler (`-pooler` en el host) Prisma Migrate falla a medias; sin TLS, la
 * contraseña viajaría en claro (SEC-21).
 */
function directDatabaseUrl(): string {
  const direct = process.env.DATABASE_URL_UNPOOLED;
  if (!direct) {
    fail(
      "Falta DATABASE_URL_UNPOOLED (conexión directa de Neon, sin -pooler): las migraciones no se pueden aplicar por el pooler. Ver docs/deploy.md.",
    );
  }
  const url = URL.canParse(direct) ? new URL(direct) : null;
  if (!url || !/^postgres(ql)?:$/.test(url.protocol)) {
    fail("DATABASE_URL_UNPOOLED no es una URL postgresql:// válida. Ver docs/deploy.md.");
  }
  if (url.hostname.includes("-pooler")) {
    fail(
      "DATABASE_URL_UNPOOLED apunta al pooler (host con -pooler): usa la cadena directa de Neon. Ver docs/deploy.md.",
    );
  }
  if (!["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode") ?? "")) {
    fail("DATABASE_URL_UNPOOLED debe llevar sslmode=require (o verify-full). Ver docs/deploy.md.");
  }
  return direct;
}

const target = process.env.VERCEL_ENV;
const direct = target === "production" ? directDatabaseUrl() : null;

run("pnpm", ["exec", "prisma", "generate"]);
run("pnpm", ["exec", "next", "build"]);

if (direct === null) {
  console.warn(`VERCEL_ENV=${target ?? "(sin definir)"}: no se aplican migraciones.`);
} else {
  console.warn("Producción: aplicando migraciones pendientes (prisma migrate deploy)…");
  run("pnpm", ["exec", "prisma", "migrate", "deploy"], { ...process.env, DATABASE_URL: direct });
}
