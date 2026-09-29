/**
 * Datos iniciales. Idempotente: se puede ejecutar varias veces (`pnpm db:seed`).
 *
 * - Siempre: categorías, comunidades y ajustes de plataforma por defecto.
 * - Solo fuera de producción: cuentas editoriales con contenido semilla y vendedores de demostración.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { siteConfig } from "../src/config/site";
import { AI_BUDGET_KEY, DEFAULT_AI_BUDGET } from "../src/modules/ai/budget";
import { COMMERCE_FEES_KEY, DEFAULT_COMMERCE_FEES } from "../src/modules/commerce/fees";
import { DEFAULT_FEED_POLICY, FEED_POLICY_KEY } from "../src/modules/feed/policy";
import { parseEnv } from "../src/lib/env/parse-env";
import { processImage } from "../src/modules/media/image-processing";
import { createPrismaClient, type Database } from "../src/server/db-client";
import { serverEnvSchema } from "../src/server/env-schema";
import { createStorage } from "../src/server/providers/storage/factory";
import { categories } from "./seed/categories";
import { communities } from "./seed/communities";
import { posterSvg } from "./seed/images";
import { PHOTO_LICENSES, photoFileName, seedPhotos } from "./seed/photos";
import { demoSellers } from "./seed/products";

if (!process.env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL. Ejecuta `pnpm db:setup` primero.");
}
const env = parseEnv(serverEnvSchema, process.env);

const db = createPrismaClient(env.DATABASE_URL);
// El mismo almacenamiento que la app: las imágenes semilla quedan en S3/R2 si así está configurado.
const storage = createStorage(env);
const isProduction = env.NODE_ENV === "production";
const HOUR = 60 * 60 * 1000;

async function seedCategories() {
  const ids = new Map<string, string>();
  for (const [index, category] of categories.entries()) {
    const parent = await db.category.upsert({
      where: { slug: category.slug },
      create: { slug: category.slug, name: category.name, sortOrder: index },
      update: { name: category.name, sortOrder: index },
    });
    ids.set(category.slug, parent.id);
    for (const [childIndex, child] of (category.children ?? []).entries()) {
      const created = await db.category.upsert({
        where: { slug: child.slug },
        create: { slug: child.slug, name: child.name, sortOrder: childIndex, parentId: parent.id },
        update: { name: child.name, sortOrder: childIndex, parentId: parent.id },
      });
      ids.set(child.slug, created.id);
    }
  }
  return ids;
}

async function seedCommunities(categoryIds: Map<string, string>) {
  const ids = new Map<string, string>();
  for (const [index, community] of communities.entries()) {
    const { id } = await db.community.upsert({
      where: { slug: community.slug },
      create: {
        slug: community.slug,
        name: community.name,
        emoji: community.emoji,
        hue: community.hue,
        description: community.description,
        sortOrder: index,
      },
      update: {
        name: community.name,
        emoji: community.emoji,
        hue: community.hue,
        description: community.description,
        sortOrder: index,
      },
    });
    ids.set(community.slug, id);
    for (const slug of community.categorySlugs) {
      const categoryId = categoryIds.get(slug);
      if (!categoryId) throw new Error(`Categoría desconocida: ${slug}`);
      await db.communityCategory.upsert({
        where: { communityId_categoryId: { communityId: id, categoryId } },
        create: { communityId: id, categoryId },
        update: {},
      });
    }
  }
  return ids;
}

async function seedPlatformSettings() {
  for (const [key, value] of [
    [FEED_POLICY_KEY, DEFAULT_FEED_POLICY],
    [AI_BUDGET_KEY, DEFAULT_AI_BUDGET],
    [COMMERCE_FEES_KEY, DEFAULT_COMMERCE_FEES],
  ] as const) {
    await db.platformSetting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
}

type Credit = { creditName: string; creditUrl: string; sourceUrl: string; license: string };

async function storeImage(ownerId: string, input: Buffer, altText: string, credit?: Credit) {
  const image = await processImage(input);
  const storageKey = `seed/${randomUUID()}.webp`;
  await storage.put(storageKey, image.buffer);
  return db.media.create({
    data: {
      ownerId,
      storageKey,
      mimeType: image.mimeType,
      width: image.width,
      height: image.height,
      sizeBytes: image.sizeBytes,
      blurDataUrl: image.blurDataUrl,
      altText,
      ...credit,
    },
  });
}

async function storePoster(ownerId: string, svg: Buffer, altText: string) {
  return storeImage(ownerId, await sharp(svg).png().toBuffer(), altText);
}

/** Foto de stock del manifiesto (`pnpm seed:photos`), con su crédito; `null` si no se descargó. */
async function storePhoto(ownerId: string, key: string) {
  const photo = seedPhotos[key];
  const file = path.join("prisma", "seed", "photos", photoFileName(key));
  if (!photo || !existsSync(file)) return null;
  return storeImage(ownerId, readFileSync(file), photo.alt, {
    creditName: photo.photographer,
    creditUrl: photo.photographerUrl,
    sourceUrl: photo.pageUrl,
    license: PHOTO_LICENSES[photo.source].name,
  });
}

/**
 * Cambia un cartel por su foto en datos ya sembrados: crea la foto, copia los enlaces del cartel
 * (publicación y producto) y borra el cartel. No toca medios que ya tienen crédito.
 */
async function replacePosterWithPhoto(mediaId: string, key: string) {
  const old = await db.media.findUnique({
    where: { id: mediaId },
    include: { postLinks: true, productLinks: true },
  });
  if (!old || old.creditName) return false;
  const photo = await storePhoto(old.ownerId, key);
  if (!photo) return false;
  await db.$transaction([
    ...old.postLinks.map((link) =>
      db.postMedia.create({
        data: { postId: link.postId, mediaId: photo.id, position: link.position },
      }),
    ),
    ...old.productLinks.map((link) =>
      db.productMedia.create({
        data: { productId: link.productId, mediaId: photo.id, position: link.position },
      }),
    ),
    db.media.delete({ where: { id: old.id } }),
  ]);
  await storage.delete(old.storageKey);
  return true;
}

/** Semillas anteriores a las fotos: cambia sus carteles por las fotos del manifiesto. */
async function refreshSeedPhotos() {
  let replaced = 0;
  for (const community of communities) {
    const editor = await db.user.findUnique({
      where: { email: `editorial.${community.slug}@vendeia.invalid` },
      select: { id: true },
    });
    if (!editor) continue;
    for (const [postIndex, post] of community.posts.entries()) {
      const key = `${community.slug}-${postIndex}`;
      if (!post.image || !seedPhotos[key]) continue;
      const links = await db.postMedia.findMany({
        where: { post: { authorId: editor.id, body: post.body } },
        select: { mediaId: true },
      });
      for (const { mediaId } of links) {
        if (await replacePosterWithPhoto(mediaId, key)) replaced += 1;
      }
    }
  }
  for (const product of demoSellers.flatMap((seller) => seller.products)) {
    const key = `product:${product.slug}`;
    const links = await db.productMedia.findMany({
      where: { product: { slug: product.slug } },
      select: { mediaId: true },
    });
    for (const { mediaId } of links) {
      if (await replacePosterWithPhoto(mediaId, key)) replaced += 1;
    }
  }
  return replaced;
}

async function upsertUser(
  database: Database,
  input: { email: string; name: string; username: string; bio: string; isEditorial: boolean },
) {
  return database.user.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      name: input.name,
      emailVerified: true,
      profile: {
        create: {
          username: input.username,
          displayName: input.name,
          bio: input.bio,
          isEditorial: input.isEditorial,
          onboardedAt: new Date(),
        },
      },
    },
    update: {},
  });
}

async function seedEditorialContent(communityIds: Map<string, string>) {
  let created = 0;
  for (const [communityIndex, community] of communities.entries()) {
    const communityId = communityIds.get(community.slug)!;
    // La comunidad ya se muestra junto al autor, así que la cuenta se llama solo «Equipo VendeIA».
    const editorName = `Equipo ${siteConfig.name}`;
    const editor = await upsertUser(db, {
      email: `editorial.${community.slug}@vendeia.invalid`,
      name: editorName,
      username: `equipo.${community.slug}`,
      bio: `Cuenta editorial de la comunidad ${community.name}. Contenido creado por el equipo con ayuda de IA.`,
      isEditorial: true,
    });
    await db.user.update({
      where: { id: editor.id },
      data: { name: editorName, profile: { update: { displayName: editorName } } },
    });
    if ((await db.post.count({ where: { authorId: editor.id } })) > 0) continue;

    for (const [postIndex, post] of community.posts.entries()) {
      // Escalonamos las fechas para que el feed tenga contenido reciente y variado.
      const publishedAt = new Date(Date.now() - (postIndex * 12 + communityIndex * 2 + 1) * HOUR);
      const media = post.image
        ? ((await storePhoto(editor.id, `${community.slug}-${postIndex}`)) ??
          (await storePoster(
            editor.id,
            posterSvg({ title: post.image, kicker: `${community.name}`, hue: community.hue }),
            post.image,
          )))
        : null;
      await db.post.create({
        data: {
          authorId: editor.id,
          communityId,
          body: post.body,
          isAiGenerated: true,
          publishedAt,
          media: media ? { create: { mediaId: media.id, position: 0 } } : undefined,
        },
      });
      created += 1;
    }
  }
  return created;
}

async function seedDemoSellers(
  categoryIds: Map<string, string>,
  communityIds: Map<string, string>,
) {
  let created = 0;
  for (const seller of demoSellers) {
    const user = await upsertUser(db, {
      email: `${seller.username}@vendeia.invalid`,
      name: seller.displayName,
      username: seller.username,
      bio: "Cuenta de demostración: productos y datos ficticios para probar la plataforma.",
      isEditorial: false,
    });
    const sellerProfile = await db.sellerProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        displayName: seller.displayName,
        description: "Vendedor de demostración.",
        city: seller.city,
        state: seller.state,
        acceptedPaymentMethods: seller.paymentMethods,
      },
      update: {},
    });

    for (const [index, product] of seller.products.entries()) {
      if (await db.product.findUnique({ where: { slug: product.slug }, select: { id: true } })) {
        continue;
      }
      const categoryId = categoryIds.get(product.categorySlug);
      const communityId = communityIds.get(product.communitySlug);
      if (!categoryId || !communityId) throw new Error(`Referencia inválida en ${product.slug}`);

      // Sin precio dentro de la imagen: el precio siempre sale de `priceCents` (P2).
      const media =
        (await storePhoto(user.id, `product:${product.slug}`)) ??
        (await storePoster(
          user.id,
          posterSvg({ title: product.title, kicker: "Demostración", hue: 12 + index * 35 }),
          product.title,
        ));
      const publishedAt = new Date(Date.now() - (index * 9 + 5) * HOUR);
      const created_ = await db.product.create({
        data: {
          sellerId: sellerProfile.id,
          slug: product.slug,
          title: product.title,
          description: product.description,
          priceCents: product.price * 100,
          stock: product.stock,
          categoryId,
          condition: product.condition,
          authenticity: product.authenticity,
          warrantyType: product.warrantyType,
          warrantyDays: product.warrantyDays ?? null,
          returnWindowDays: product.returnWindowDays,
          pickupAvailable: product.pickupAvailable,
          localDeliveryAvailable: product.localDeliveryZones.length > 0,
          localDeliveryZones: product.localDeliveryZones,
          nationalShippingAvailable: Boolean(product.nationalShipping),
          shippingPriceCents: product.nationalShipping
            ? product.nationalShipping.price * 100
            : null,
          deliveryMinDays: product.nationalShipping?.minDays ?? null,
          deliveryMaxDays: product.nationalShipping?.maxDays ?? null,
          tags: product.tags,
          city: seller.city,
          state: seller.state,
          publishedAt,
          cost: { create: { unitCostCents: product.cost * 100 } },
          media: { create: { mediaId: media.id, position: 0 } },
        },
      });
      await db.post.create({
        data: {
          authorId: user.id,
          communityId,
          type: "PRODUCT",
          body: product.postBody,
          productId: created_.id,
          publishedAt,
          media: { create: { mediaId: media.id, position: 0 } },
        },
      });
      created += 1;
    }
  }
  return created;
}

async function main() {
  const categoryIds = await seedCategories();
  const communityIds = await seedCommunities(categoryIds);
  await seedPlatformSettings();
  console.warn(`✓ ${categoryIds.size} categorías, ${communityIds.size} comunidades, ajustes base`);

  if (isProduction) {
    console.warn("• Producción: se omite el contenido editorial y de demostración.");
    return;
  }
  const posts = await seedEditorialContent(communityIds);
  const products = await seedDemoSellers(categoryIds, communityIds);
  const photos = await refreshSeedPhotos();
  console.warn(
    `✓ ${posts} publicaciones editoriales y ${products} productos de demostración nuevos; ${photos} carteles cambiados por fotos`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
