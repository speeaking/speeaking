/** Publicación explícita y repetible del paquete editorial autorizado por el administrador. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseDotenv } from "dotenv";
import assets from "../content/editorial/launch-20261003/assets.json";
import { collections, EDITION, publicationBody } from "../content/editorial/launch-20261003/posts";
import { ensureEditorialAccount } from "../src/modules/editorial/account";
import { MAX_POST_LENGTH } from "../src/modules/social/schemas";
import { createPrismaClient } from "../src/server/db-client";

const args = process.argv.slice(2);
const target = args[args.indexOf("--target") + 1];
if (!args.includes("--target") || !["local", "production"].includes(target ?? "")) {
  throw new Error(
    "Usa --target local|production. Añade --publish para publicar; sin él solo revisa.",
  );
}
if (args.some((arg) => !["--target", "local", "production", "--publish"].includes(arg))) {
  throw new Error("Argumento desconocido.");
}
const publish = args.includes("--publish");

async function main() {
  const vars = parseDotenv(await readFile(target === "local" ? ".env" : ".env.production.local"));
  // No usar variables globales que pudieran apuntar accidentalmente a otra base.
  let connection: URL;
  try {
    connection = new URL(vars.DATABASE_URL ?? "");
  } catch {
    throw new Error("Falta una conexión válida en el archivo del entorno elegido.");
  }
  if (target === "local") {
    if (
      !["localhost", "127.0.0.1"].includes(connection.hostname) ||
      connection.port !== "5434" ||
      connection.pathname !== "/speeaking"
    )
      throw new Error("La conexión no es la base local de speeaking.");
  } else if (
    ![
      "ep-divine-king-b8sj5eyi.c-14.us-east-1.aws.neon.tech",
      "ep-divine-king-b8sj5eyi-pooler.c-14.us-east-1.aws.neon.tech",
    ].includes(connection.hostname) ||
    connection.pathname !== "/neondb"
  )
    throw new Error("La conexión no es la producción de speeaking autorizada.");

  const images = new Map(assets.map((asset) => [asset.slug, asset]));
  const keys = new Set<string>();
  for (const collection of collections) {
    for (const post of collection.posts) {
      const key = `${EDITION}:${collection.slug}:${post.key}`;
      if (keys.has(key)) throw new Error("Hay una publicación repetida en el paquete.");
      keys.add(key);
      const body = publicationBody(post);
      if (!body.trim() || body.length > MAX_POST_LENGTH) throw new Error(`Texto inválido: ${key}`);
      if (post.source && new URL(post.source.url).protocol !== "https:")
        throw new Error("Fuente insegura.");
      if (post.image && !images.has(post.image)) throw new Error(`Falta imagen: ${key}`);
    }
  }
  // Revisa TODOS los archivos antes de escribir la primera fila.
  for (const asset of assets) {
    const bytes = await readFile(
      join("content", "editorial", EDITION, "images", `${asset.slug}.webp`),
    );
    if (
      bytes.length !== asset.sizeBytes ||
      createHash("sha256").update(bytes).digest("hex") !== asset.sha256
    ) {
      throw new Error(`La imagen no coincide con el manifiesto: ${asset.slug}`);
    }
    for (const width of asset.variants) {
      await readFile(
        join("content", "editorial", EDITION, "images", `${asset.slug}-w${width}.webp`),
      );
    }
  }

  const db = createPrismaClient(connection.href);
  try {
    const admin = await db.user.findUnique({
      where: { email: "speeaking@gmail.com" },
      select: { id: true, profile: { select: { role: true } } },
    });
    if (admin?.profile?.role !== "ADMIN")
      throw new Error("No se encontró al administrador autorizado.");
    const official = await db.community.findMany({
      where: { isOfficial: true, slug: { in: collections.map((collection) => collection.slug) } },
      select: { id: true, slug: true, name: true },
    });
    if (official.length !== collections.length)
      throw new Error("Faltan comunidades oficiales del paquete.");
    const existing = await db.editorialDraft.count({ where: { autoKey: { in: [...keys] } } });
    process.stdout.write(
      JSON.stringify({
        target,
        edition: EDITION,
        mode: publish ? "publish" : "preview",
        communities: official.length,
        posts: keys.size,
        images: assets.length,
        alreadyProcessed: existing,
      }) + "\n",
    );
    if (!publish) return;

    let created = 0;
    let skipped = 0;
    // Primero las conversaciones y después las guías visuales: la imagen queda arriba en cada
    // comunidad. Se usa la hora REAL de cada publicación, sin simular días de actividad previa.
    for (const position of [2, 1, 0]) {
      for (const collection of collections) {
        const entry = collection.posts[position]!;
        const community = official.find((item) => item.slug === collection.slug)!;
        const autoKey = `${EDITION}:${collection.slug}:${entry.key}`;
        const authorId = await ensureEditorialAccount(db, community);
        const outcome = await db.$transaction(async (tx) => {
          // Repetir el comando o ejecutarlo simultáneamente no duplica publicaciones. Un borrador
          // ya retirado tampoco se vuelve a publicar: la decisión del equipo se conserva.
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${autoKey}, 0))::text`;
          if (await tx.editorialDraft.findUnique({ where: { autoKey }, select: { id: true } }))
            return false;
          const now = new Date();
          const asset = entry.image ? images.get(entry.image)! : null;
          let mediaId: string | null = null;
          if (asset) {
            const { slug: _slug, sha256: _sha256, variants: _variants, ...media } = asset;
            void _slug;
            void _sha256;
            void _variants;
            const photo = await tx.media.upsert({
              where: { storageKey: asset.storageKey },
              create: { ...media, ownerId: authorId, status: "READY", kind: "IMAGE" },
              update: {},
              select: { id: true, ownerId: true },
            });
            if (photo.ownerId !== authorId)
              throw new Error("La imagen editorial pertenece a otra cuenta.");
            mediaId = photo.id;
          }
          const body = publicationBody(entry);
          const post = await tx.post.create({
            data: {
              authorId,
              communityId: community.id,
              body,
              isAiGenerated: true,
              publishedAt: now,
              // Reacciones, comentarios y guardados conservan su valor inicial real: cero.
              ...(mediaId ? { media: { create: { mediaId, position: 0 } } } : {}),
            },
            select: { id: true },
          });
          const day = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Mexico_City",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(now);
          await tx.editorialDraft.create({
            data: {
              communityId: community.id,
              kind: "TOPIC",
              day: new Date(`${day}T00:00:00Z`),
              autoKey,
              body,
              topic: entry.key,
              status: "PUBLISHED",
              provider: "curated_editorial",
              model: "assisted-editorial",
              promptVersion: EDITION,
              postId: post.id,
              reviewedById: admin.id,
              reviewedAt: now,
            },
          });
          return true;
        });
        if (outcome) created++;
        else skipped++;
      }
    }
    process.stdout.write(JSON.stringify({ target, created, skipped, edition: EDITION }) + "\n");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  // Nunca volcar un error del driver: podría incluir credenciales o SQL con datos personales.
  console.error(
    `No se pudo completar la publicación editorial (${error instanceof Error ? error.name : "Error"}).`,
  );
  process.exitCode = 1;
});
