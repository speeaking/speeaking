/**
 * Base de datos de desarrollo (ADR-017): un clúster de PostgreSQL 17 propio del proyecto, creado con
 * los binarios instalados en el sistema. No toca el servicio de PostgreSQL existente.
 *
 *   pnpm db:setup   genera secretos locales, crea el clúster (si no existe), lo inicia, crea la base
 *                   `vendeia` y escribe DATABASE_URL en .env con una contraseña aleatoria
 *   pnpm db:start   inicia el clúster
 *   pnpm db:stop    detiene el clúster
 *   pnpm db:status  muestra si está corriendo
 *
 * Variables opcionales: PG_BIN (carpeta de binarios), DEV_DB_PORT (por defecto 5434).
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dataDir = join(root, ".data", "postgres");
const logFile = join(root, ".data", "postgres.log");
const envFile = join(root, ".env");
const port = Number(process.env.DEV_DB_PORT ?? 5434);
const dbName = "vendeia";
const dbUser = "vendeia";
const NEWLINE = String.fromCharCode(10);

function pgBin(tool: string) {
  const candidates = [
    process.env.PG_BIN,
    process.platform === "win32" ? "C:\\Program Files\\PostgreSQL\\17\\bin" : undefined,
  ].filter(Boolean) as string[];
  for (const dir of candidates) {
    const file = join(dir, process.platform === "win32" ? `${tool}.exe` : tool);
    if (existsSync(file)) return file;
  }
  return tool; // se busca en PATH
}

function run(tool: string, args: string[], env: Record<string, string> = {}) {
  const result = spawnSync(pgBin(tool), args, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() };
}

function isRunning() {
  return run("pg_ctl", ["status", "-D", dataDir]).ok;
}

function start() {
  if (isRunning()) return console.warn("✓ El clúster ya está corriendo.");
  // Sin tuberías: en Windows el servidor hereda stdout/stderr y spawnSync nunca terminaría.
  // La salida del servidor va a .data/postgres.log.
  const result = spawnSync(pgBin("pg_ctl"), ["start", "-D", dataDir, "-l", logFile, "-w"], {
    stdio: "ignore",
  });
  if (result.status !== 0) throw new Error(`No se pudo iniciar PostgreSQL; revisa ${logFile}`);
  console.warn(`✓ PostgreSQL 17 corriendo en localhost:${port}`);
}

function stop() {
  if (!isRunning()) return console.warn("✓ El clúster ya estaba detenido.");
  const result = run("pg_ctl", ["stop", "-D", dataDir, "-m", "fast", "-w"]);
  if (!result.ok) throw new Error(`No se pudo detener PostgreSQL:${NEWLINE}${result.output}`);
  console.warn("✓ PostgreSQL detenido.");
}

function readEnvLines() {
  if (!existsSync(envFile)) return [];
  return readFileSync(envFile, "utf8")
    .split(NEWLINE)
    .map((line) => line.trimEnd())
    .filter(Boolean);
}

function setEnvVar(name: string, value: string) {
  const lines = readEnvLines().filter((line) => !line.startsWith(`${name}=`));
  lines.push(`${name}="${value}"`);
  writeFileSync(envFile, lines.join(NEWLINE) + NEWLINE, { mode: 0o600 });
}

/** Genera un secreto aleatorio si la variable aún no existe en .env (nunca lo imprime). */
function ensureSecret(name: string) {
  if (readEnvLines().some((line) => line.startsWith(`${name}=`))) return;
  setEnvVar(name, randomBytes(32).toString("base64url"));
  console.warn(`✓ ${name} generado en .env`);
}

function setup() {
  ensureSecret("BETTER_AUTH_SECRET");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
    const password = randomBytes(24).toString("base64url");
    const pwFile = join(root, ".data", ".pw.tmp");
    writeFileSync(pwFile, password, { mode: 0o600 });
    try {
      const init = run("initdb", [
        "-D",
        dataDir,
        "-U",
        dbUser,
        `--pwfile=${pwFile}`,
        "--auth=scram-sha-256",
        "--encoding=UTF8",
        "--locale-provider=icu",
        "--icu-locale=es-MX",
        "--locale=C",
      ]);
      if (!init.ok) throw new Error(`initdb falló:${NEWLINE}${init.output}`);
    } finally {
      rmSync(pwFile, { force: true });
    }
    const conf = join(dataDir, "postgresql.conf");
    const extra = [
      "",
      "# vendeia (scripts/dev-db.mts)",
      `port = ${port}`,
      "listen_addresses = 'localhost'",
      // UTC: con la zona de Windows, el adaptador de Prisma guardaba las fechas desfasadas (ADR-028).
      "timezone = 'UTC'",
      "",
    ];
    writeFileSync(conf, readFileSync(conf, "utf8") + extra.join(NEWLINE));
    start();
    const created = run("createdb", ["-h", "localhost", "-p", String(port), "-U", dbUser, dbName], {
      PGPASSWORD: password,
    });
    if (!created.ok) throw new Error(`createdb falló:${NEWLINE}${created.output}`);
    setEnvVar(
      "DATABASE_URL",
      `postgresql://${dbUser}:${password}@localhost:${port}/${dbName}?schema=public`,
    );
    console.warn(`✓ Base "${dbName}" creada; DATABASE_URL escrita en .env (no se versiona).`);
    return;
  }
  start();
  console.warn("✓ El clúster ya existía; DATABASE_URL en .env se conserva.");
}

const command = process.argv[2];
const commands: Record<string, () => void> = {
  setup,
  start,
  stop,
  status: () => console.warn(isRunning() ? "PostgreSQL corriendo" : "PostgreSQL detenido"),
};

const action = command ? commands[command] : undefined;
if (!action) {
  console.error("Uso: node scripts/dev-db.mts <setup|start|stop|status>");
  process.exit(1);
}
action();
