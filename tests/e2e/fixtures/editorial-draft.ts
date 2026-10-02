/**
 * Crea un borrador PENDIENTE de la redacción diaria (ADR-066) para las pruebas E2E, sin llamar a la
 * IA: en la suite la IA es simulada y, con `pnpm start`, la redacción no redacta con el simulador.
 * El texto debe empezar con «E2E » (así lo borra `pnpm db:clean-e2e`). Solo contra una base de esta
 * máquina. Uso: `pnpm exec tsx tests/e2e/fixtures/editorial-draft.ts <comunidad> <texto>`.
 */
import "dotenv/config";
import { isProductionTarget } from "../../../src/modules/admin/grant";
import { mexicoDay, dayToDbDate } from "../../../src/modules/platform/calendar";
import { createPrismaClient } from "../../../src/server/db-client";

async function main() {
  const [slug, body] = process.argv.slice(2);
  if (!slug || !body?.startsWith("E2E ")) {
    throw new Error("Uso: editorial-draft.ts <comunidad> <texto que empieza con «E2E »>");
  }
  if (isProductionTarget(process.env)) {
    throw new Error("Solo contra una base de desarrollo de esta máquina.");
  }
  const db = createPrismaClient(process.env.DATABASE_URL!);
  try {
    const community = await db.community.findUniqueOrThrow({
      where: { slug },
      select: { id: true },
    });
    const draft = await db.editorialDraft.create({
      data: {
        communityId: community.id,
        kind: "QUESTION",
        day: dayToDbDate(mexicoDay(new Date())),
        body,
        provider: "mock",
        model: "mock",
        promptVersion: "editorial@2",
      },
      select: { id: true },
    });
    // El id es la salida del script (la lee la prueba).
    process.stdout.write(`${draft.id}\n`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
