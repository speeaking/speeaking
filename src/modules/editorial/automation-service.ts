import "server-only";
import { createHash } from "node:crypto";
import { assertAdmin } from "@/modules/admin/service";
import { policyViolation } from "@/modules/ai/content-policy";
import { processImage } from "@/modules/media/image-processing";
import { db } from "@/server/db";
import { getStorage } from "@/server/providers/storage";
import { ensureEditorialAccount } from "./account";
import {
  editorialSlot,
  EDITORIAL_POSTS_PER_INTERVAL,
  EDITORIAL_AUTOMATION_MAX_CHARS,
  type EditorialSubmission,
  scheduledEditorialKey,
} from "./automation-schema";

export class EditorialSubmissionError extends Error {
  override name = "EditorialSubmissionError";
  constructor(
    readonly code: string,
    readonly status: number = 409,
  ) {
    super(code);
  }
}

const officialSelect = { id: true, slug: true, name: true, description: true } as const;

/** Dos comunidades por intervalo: la rotación cubre las doce dos veces cada día. */
export async function editorialPlan(actorId: string, now: Date = new Date()) {
  await assertAdmin(actorId);
  const communities = await db.community.findMany({
    where: { isOfficial: true },
    orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
    select: officialSelect,
  });
  const slot = editorialSlot(now).toISOString();
  const ordinal = Math.floor(now.getTime() / (2 * 60 * 60 * 1000));
  const start = communities.length
    ? (ordinal * EDITORIAL_POSTS_PER_INTERVAL) % communities.length
    : 0;
  const selected = Array.from(
    { length: Math.min(EDITORIAL_POSTS_PER_INTERVAL, communities.length) },
    (_, i) => communities[(start + i) % communities.length]!,
  );
  const done = await db.editorialDraft.findMany({
    where: { autoKey: { startsWith: `scheduled:${slot}:` } },
    select: { autoKey: true, postId: true },
  });
  const completed = new Set(done.map((draft) => draft.autoKey));
  const targets = await Promise.all(
    selected
      .filter((community) => !completed.has(scheduledEditorialKey(slot, community.slug)))
      .map(async (community) => ({
        ...community,
        recent: await db.post.findMany({
          where: {
            communityId: community.id,
            author: { profile: { isEditorial: true } },
            status: "PUBLISHED",
          },
          orderBy: { publishedAt: "desc" },
          take: 6,
          select: { body: true, publishedAt: true },
        }),
      })),
  );
  return {
    slot,
    remaining: Math.max(0, EDITORIAL_POSTS_PER_INTERVAL - done.length),
    targets,
    completedPostIds: done.flatMap((draft) => (draft.postId ? [draft.postId] : [])),
  };
}

/** Solo se entregan datos de las cuentas editoriales, nunca perfiles o fotos personales. */
export async function editorialIllustrations(actorId: string) {
  await assertAdmin(actorId);
  return db.post.findMany({
    where: {
      status: "PUBLISHED",
      type: "POST",
      productId: null,
      author: { profile: { isEditorial: true } },
      community: { isOfficial: true },
      media: { some: { position: 0 } },
    },
    orderBy: { publishedAt: "desc" },
    take: 48,
    select: {
      id: true,
      body: true,
      community: { select: { slug: true, name: true } },
      media: {
        where: { position: 0 },
        select: {
          mediaId: true,
          media: { select: { storageKey: true, width: true, height: true, altText: true } },
        },
      },
    },
  });
}

function labeledBody(input: string) {
  const note = "Imagen ilustrativa creada con IA.";
  if (input.includes(note)) return input;
  const sourceIndex = input.lastIndexOf("\n\nFuente: ");
  const body =
    sourceIndex < 0
      ? `${input}\n\n${note}`
      : `${input.slice(0, sourceIndex)}\n\n${note}${input.slice(sourceIndex)}`;
  if (body.length > EDITORIAL_AUTOMATION_MAX_CHARS)
    throw new EditorialSubmissionError("TEXT_TOO_LONG", 400);
  return body;
}

/** Procesa bytes, guarda una fila rastreable antes del archivo y deja huérfanas para el recolector. */
async function prepareImage(ownerId: string, file: File, altText: string) {
  const image = await processImage(Buffer.from(await file.arrayBuffer()));
  const digest = createHash("sha256").update(image.buffer).digest("hex");
  const storageKey = `editorial/generated/${ownerId}/${digest}.webp`;
  const label = `${altText.replace(/\s+$/, "")} Imagen ilustrativa creada con IA.`;
  const { buffer, ...metadata } = image;
  const media = await db.media.upsert({
    where: { storageKey },
    create: {
      ownerId,
      storageKey,
      ...metadata,
      altText: label,
      kind: "IMAGE",
      status: "PROCESSING",
    },
    update: {},
    select: { id: true, ownerId: true, status: true },
  });
  if (media.ownerId !== ownerId) throw new EditorialSubmissionError("IMAGE_OWNER_CONFLICT");
  if (media.status !== "READY") {
    await getStorage().put(storageKey, buffer);
    await db.media.update({ where: { id: media.id }, data: { status: "READY" } });
  }
  return media.id;
}

export async function submitEditorial(
  actorId: string,
  input: EditorialSubmission,
  files: Map<string, File>,
) {
  await assertAdmin(actorId);
  if (new Set(input.posts.map((post) => post.imagePart)).size !== input.posts.length)
    throw new EditorialSubmissionError("DUPLICATE_IMAGE_PART", 400);
  if (input.mode === "replace") return replaceIllustrations(actorId, input.posts, files);
  const plan = await editorialPlan(actorId);
  if (input.slot !== plan.slot) throw new EditorialSubmissionError("SLOT_EXPIRED");
  const communities = await db.community.findMany({
    where: { isOfficial: true },
    orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
    select: officialSelect,
  });
  if (new Set(input.posts.map((post) => post.communitySlug)).size !== input.posts.length)
    throw new EditorialSubmissionError("DUPLICATE_COMMUNITY", 400);
  const outcomes = [];
  for (const entry of input.posts) {
    const key = scheduledEditorialKey(input.slot, entry.communitySlug);
    const existing = await db.editorialDraft.findUnique({
      where: { autoKey: key },
      select: { postId: true },
    });
    if (existing) {
      outcomes.push({ postId: existing.postId, unchanged: true });
      continue;
    }
    if (!plan.targets.some((target) => target.slug === entry.communitySlug))
      throw new EditorialSubmissionError("COMMUNITY_OUTSIDE_ROTATION", 400);
    const community = communities.find((item) => item.slug === entry.communitySlug)!;
    const body = labeledBody(entry.body);
    if (policyViolation(body)) throw new EditorialSubmissionError("CONTENT_REJECTED", 422);
    const authorId = await ensureEditorialAccount(db, community);
    const mediaId = await prepareImage(authorId, files.get(entry.imagePart)!, entry.altText);
    const outcome = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`editorial:${input.slot}`}, 0))::text`;
      const role = await tx.profile.findUnique({
        where: { userId: actorId },
        select: { role: true },
      });
      if (role?.role !== "ADMIN") throw new EditorialSubmissionError("ADMIN_REQUIRED", 403);
      const duplicate = await tx.editorialDraft.findUnique({
        where: { autoKey: key },
        select: { postId: true },
      });
      if (duplicate) return { postId: duplicate.postId, unchanged: true };
      if (input.slot !== editorialSlot().toISOString())
        throw new EditorialSubmissionError("SLOT_EXPIRED");
      const used = await tx.editorialDraft.count({
        where: { autoKey: { startsWith: `scheduled:${input.slot}:` } },
      });
      if (used >= EDITORIAL_POSTS_PER_INTERVAL) throw new EditorialSubmissionError("INTERVAL_FULL");
      const now = new Date();
      const post = await tx.post.create({
        data: {
          authorId,
          communityId: community.id,
          body,
          isAiGenerated: true,
          publishedAt: now,
          media: { create: { mediaId, position: 0 } },
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
          autoKey: key,
          body,
          topic: "Publicación programada revisada",
          status: "PUBLISHED",
          provider: "curated_editorial",
          model: "assisted-editorial",
          promptVersion: "scheduled-v1",
          postId: post.id,
          reviewedById: actorId,
          reviewedAt: now,
        },
      });
      return { postId: post.id, unchanged: false };
    });
    outcomes.push(outcome);
  }
  return { mode: "publish", posts: outcomes };
}

async function replaceIllustrations(
  actorId: string,
  entries: Extract<EditorialSubmission, { mode: "replace" }>["posts"],
  files: Map<string, File>,
) {
  const outcomes = [];
  for (const entry of entries) {
    const post = await db.post.findFirst({
      where: {
        id: entry.postId,
        status: "PUBLISHED",
        type: "POST",
        productId: null,
        author: { profile: { isEditorial: true } },
        community: { isOfficial: true },
      },
      select: { authorId: true, community: { select: officialSelect } },
    });
    if (!post?.community) throw new EditorialSubmissionError("EDITORIAL_POST_NOT_FOUND", 404);
    if ((await ensureEditorialAccount(db, post.community)) !== post.authorId)
      throw new EditorialSubmissionError("EDITORIAL_AUTHOR_CONFLICT");
    const mediaId = await prepareImage(post.authorId, files.get(entry.imagePart)!, entry.altText);
    const unchanged = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`editorial:image:${entry.postId}`}, 0))::text`;
      const role = await tx.profile.findUnique({
        where: { userId: actorId },
        select: { role: true },
      });
      if (role?.role !== "ADMIN") throw new EditorialSubmissionError("ADMIN_REQUIRED", 403);
      const current = await tx.post.findFirst({
        where: {
          id: entry.postId,
          status: "PUBLISHED",
          authorId: post.authorId,
          productId: null,
          author: { profile: { isEditorial: true } },
        },
        select: { media: { where: { position: 0 }, select: { mediaId: true } } },
      });
      if (!current) throw new EditorialSubmissionError("EDITORIAL_POST_NOT_FOUND", 404);
      if (current.media.some((item) => item.mediaId === mediaId)) return true;
      if (current.media.length !== 1 || current.media[0]?.mediaId !== entry.expectedMediaId)
        throw new EditorialSubmissionError("IMAGE_CHANGED");
      await tx.postMedia.deleteMany({
        where: { postId: entry.postId, position: 0, mediaId: entry.expectedMediaId },
      });
      await tx.postMedia.create({ data: { postId: entry.postId, mediaId, position: 0 } });
      await tx.post.update({ where: { id: entry.postId }, data: { isAiGenerated: true } });
      return false;
    });
    outcomes.push({ postId: entry.postId, unchanged });
  }
  return { mode: "replace", posts: outcomes };
}
