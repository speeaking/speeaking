import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseDotenv } from "dotenv";
import { EDITORIAL_TOKEN_PREFIX } from "../src/modules/editorial/automation-schema";
import { createPrismaClient } from "../src/server/db-client";

const args = process.argv.slice(2);
const target = args[args.indexOf("--target") + 1];
const create = args.includes("--create");
const revoke = args.includes("--revoke");
if (
  !args.includes("--target") ||
  !["local", "production"].includes(target ?? "") ||
  create === revoke ||
  args.some((arg) => !["--target", "local", "production", "--create", "--revoke"].includes(arg))
)
  throw new Error("Usa --target local|production y --create o --revoke.");

async function main() {
  const vars = parseDotenv(
    await readFile(target === "production" ? ".env.production.local" : ".env"),
  );
  let url: URL;
  try {
    url = new URL(vars.DATABASE_URL ?? "");
  } catch {
    throw new Error("InvalidDatabase");
  }
  if (
    target === "production"
      ? ![
          "ep-divine-king-b8sj5eyi.c-14.us-east-1.aws.neon.tech",
          "ep-divine-king-b8sj5eyi-pooler.c-14.us-east-1.aws.neon.tech",
        ].includes(url.hostname) || url.pathname !== "/neondb"
      : !["localhost", "127.0.0.1"].includes(url.hostname) ||
        url.port !== "5434" ||
        url.pathname !== "/speeaking"
  )
    throw new Error("UnexpectedDatabase");
  const db = createPrismaClient(url.href);
  try {
    const admin = await db.user.findUnique({
      where: { email: "speeaking@gmail.com" },
      select: { id: true, profile: { select: { role: true } } },
    });
    if (admin?.profile?.role !== "ADMIN") throw new Error("AdminRequired");
    const root = join(process.cwd(), ".data", "editorial-automation");
    const accessFile = join(root, `access-${target}.json`);
    if (revoke) {
      const result = await db.editorialAutomationToken.updateMany({
        where: { userId: admin.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      process.stdout.write(JSON.stringify({ target, revoked: result.count }) + "\n");
      return;
    }
    await mkdir(root, { recursive: true, mode: 0o700 });
    if (process.platform === "win32") {
      const protection = spawnSync(
        join(
          process.env["SystemRoot"] ?? "C:\\Windows",
          "System32",
          "WindowsPowerShell",
          "v1.0",
          "powershell.exe",
        ),
        [
          "-NoProfile",
          "-NonInteractive",
          "-File",
          join(process.cwd(), "scripts", "editorial-private-directory.ps1"),
          "-Directory",
          root,
        ],
        { encoding: "utf8" },
      );
      if (protection.status !== 0 || protection.error)
        throw new Error("CredentialProtectionFailed");
    }
    let token: string | null = null;
    try {
      const saved = JSON.parse(await readFile(accessFile, "utf8")) as { token?: unknown };
      if (
        typeof saved.token === "string" &&
        new RegExp(`^${EDITORIAL_TOKEN_PREFIX}[A-Za-z0-9_-]{43}$`).test(saved.token)
      ) {
        const existing = await db.editorialAutomationToken.findUnique({
          where: { tokenHash: createHash("sha256").update(saved.token).digest("hex") },
          select: { userId: true, revokedAt: true },
        });
        if (existing?.userId === admin.id && !existing.revokedAt) token = saved.token;
      }
    } catch {
      /* La primera ejecución no tiene credencial guardada. */
    }
    if (!token) {
      token = EDITORIAL_TOKEN_PREFIX + randomBytes(32).toString("base64url");
      await db.editorialAutomationToken.create({
        data: { userId: admin.id, tokenHash: createHash("sha256").update(token).digest("hex") },
      });
      await writeFile(accessFile, JSON.stringify({ token }) + "\n", { mode: 0o600 });
    }
    process.stdout.write(JSON.stringify({ target, credentialReady: true, accessFile }) + "\n");
  } finally {
    await db.$disconnect();
  }
}
main().catch((error: unknown) => {
  const known = [
    "InvalidDatabase",
    "UnexpectedDatabase",
    "AdminRequired",
    "CredentialProtectionFailed",
  ];
  const reason =
    error instanceof Error && known.includes(error.message)
      ? error.message
      : "DatabaseOrFilesystemUnavailable";
  console.error(
    `No se pudo preparar la credencial editorial: ${reason}. No se imprimieron secretos.`,
  );
  process.exitCode = 1;
});
