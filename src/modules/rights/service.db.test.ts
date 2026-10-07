import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Aviso y retirada (ADR-076) contra la base de desarrollo (`pnpm db:start`): el aviso sin cuenta
 * resuelve sus direcciones, el equipo retira (moderación de trust + archivos bloqueados + aviso en la
 * campana), quien lo subió ve SU caso y manda un contra-aviso con su plazo en días hábiles, las
 * faltas se cuentan y restaurar solo toca lo que ocultó este aviso. Crea cuentas
 * `e2e.fix.derechos*@example.com`, una categoría y avisos temporales, y borra todo al final.
 */
const { databaseUrl } = await vi.hoisted(async () => {
  const { config } = await import("dotenv");
  const local: Record<string, string | undefined> = {};
  config({ quiet: true, processEnv: local });
  return { databaseUrl: process.env.DATABASE_URL ?? local.DATABASE_URL };
});

vi.mock("@/server/db", async () => {
  const { createPrismaClient } = await import("@/server/db-client");
  return { db: createPrismaClient(databaseUrl ?? "postgresql://localhost:1/sin-base") };
});
// Sin proveedor de correo: nada sale de la máquina y la interfaz no promete correos.
vi.mock("@/server/env", () => ({
  env: {
    NODE_ENV: "test",
    TRUSTED_PROXY_HOPS: 0,
    AI_PROVIDER: "mock",
    STORAGE_LOCAL_ROOT: ".data",
    APP_URL: "http://localhost:3000",
  },
}));
vi.mock("@/server/providers/storage", () => ({
  getStorage: () => ({ publicUrl: (key: string) => `/media/${key}` }),
}));

const { db } = await import("@/server/db");
const rights = await import("./service");
const { applyModerationAction } = await import("@/modules/trust/service");
const { AdminAuthorizationError } = await import("@/modules/admin/service");
const { listNotifications } = await import("@/modules/notifications/queries");
const { noticeInputSchema, counterNoticeInputSchema } = await import("./schemas");

const RUN = randomUUID().slice(0, 8);
const hash = () => createHash("sha256").update(randomUUID()).digest("hex");
const hashes = { post: hash(), product: hash(), other: hash(), twice: hash() };
const ids = {
  admin: "",
  seller: "",
  other: "",
  categoryId: "",
  post: "",
  otherPost: "",
  product: "",
  productSlug: "",
  productKey: "",
};
const noticeIds: string[] = [];
// Un miércoles en la Ciudad de México: 10 días hábiles después es el miércoles de dos semanas.
const WEDNESDAY = new Date("2026-10-07T10:00:00-06:00");

async function createAccount(tag: string, role: "USER" | "ADMIN") {
  const user = await db.user.create({
    data: {
      name: `Derechos ${tag}`,
      email: `e2e.fix.derechos.${RUN}.${tag}@example.com`,
      profile: {
        create: {
          username: `e2e.fix.derechos.${RUN}.${tag}`.slice(0, 30),
          displayName: `Derechos ${tag}`,
          onboardedAt: new Date(),
          role,
        },
      },
    },
    select: { id: true },
  });
  return user.id;
}

async function media(ownerId: string, sha256: string) {
  return db.media.create({
    data: {
      ownerId,
      storageKey: `pruebas/derechos/${RUN}/${randomUUID()}.webp`,
      mimeType: "image/webp",
      width: 800,
      height: 800,
      sizeBytes: 1000,
      sha256,
    },
    select: { id: true, storageKey: true },
  });
}

function notice(urls: string[]) {
  return noticeInputSchema.parse({
    kind: "COPYRIGHT",
    claimantName: "Estudio Luz",
    claimantEmail: `e2e.fix.derechos.${RUN}.estudio@example.com`,
    claimantDomicile: "Av. Reforma 100, Juárez, 06600, Ciudad de México",
    claimantRole: "OWNER",
    workDescription: "Fotografía «Atardecer en Bacalar».",
    rightDescription: "Soy la autora y titular de los derechos patrimoniales.",
    facts: "La publicaron sin permiso para vender un tour.",
    urls: urls.join("\n"),
    swornStatement: "on",
    penaltyAcknowledged: "on",
  });
}

async function submitAll(urls: string[]) {
  const created = await rights.submitNotice(notice(urls), { submittedById: null });
  noticeIds.push(...created.cases.map((item) => item.id));
  return created;
}

/** Aviso de lo de una sola cuenta: un solo caso. */
async function submit(urls: string[]) {
  const { cases } = await submitAll(urls);
  expect(cases).toHaveLength(1);
  return cases[0]!;
}

describe.skipIf(!databaseUrl)("aviso y retirada contra PostgreSQL", () => {
  beforeAll(async () => {
    ids.admin = await createAccount("equipo", "ADMIN");
    ids.seller = await createAccount("tienda", "USER");
    const seller = await db.sellerProfile.create({
      data: { userId: ids.seller, displayName: `Tienda ${RUN}` },
      select: { id: true },
    });
    ids.categoryId = (
      await db.category.create({
        data: { slug: `derechos-${RUN}`, name: `Derechos ${RUN}` },
        select: { id: true },
      })
    ).id;
    const postPhoto = await media(ids.seller, hashes.post);
    const productPhoto = await media(ids.seller, hashes.product);
    const otherPhoto = await media(ids.seller, hashes.other);
    ids.productKey = productPhoto.storageKey;
    ids.productSlug = `tour-bacalar-${RUN}`;
    ids.product = (
      await db.product.create({
        data: {
          sellerId: seller.id,
          categoryId: ids.categoryId,
          slug: ids.productSlug,
          title: "Tour Bacalar",
          description: "Producto de prueba de avisos de derechos.",
          priceCents: 90_000,
          stock: 3,
          status: "ACTIVE",
          city: "Bacalar",
          state: "Quintana Roo",
          media: { create: [{ mediaId: productPhoto.id }] },
        },
        select: { id: true },
      })
    ).id;
    ids.post = (
      await db.post.create({
        data: {
          authorId: ids.seller,
          body: "Atardecer increíble",
          media: { create: [{ mediaId: postPhoto.id }] },
        },
        select: { id: true },
      })
    ).id;
    ids.otherPost = (
      await db.post.create({
        data: {
          authorId: ids.seller,
          body: "Otra foto",
          media: { create: [{ mediaId: otherPhoto.id }] },
        },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    await db.blockedMediaHash.deleteMany({ where: { sha256: { in: Object.values(hashes) } } });
    await db.rightsNotice.deleteMany({ where: { id: { in: noticeIds } } });
    await db.platformDecision.deleteMany({ where: { approvedById: ids.admin } });
    await db.user.deleteMany({
      where: { id: { in: [ids.admin, ids.seller, ids.other].filter(Boolean) } },
    });
    if (ids.categoryId) await db.category.delete({ where: { id: ids.categoryId } });
    await db.$disconnect();
  });

  it("recibe el aviso sin cuenta y resuelve lo que señala en speeaking", async () => {
    const { cases, emailSent } = await submitAll([
      `http://localhost:3000/p/${ids.post}`,
      `https://www.speeaking.com/producto/${ids.productSlug}`,
      // La foto del mismo producto: no lo duplica.
      `http://localhost:3000/media/${ids.productKey}?w=640`,
      "https://otro.example/no-es-nuestro",
    ]);

    expect(cases).toHaveLength(1);
    const created = cases[0]!;
    expect(created.caseNumber).toMatch(/^DA-\d{6,}$/);
    expect(created.targetCount).toBe(2);
    expect(emailSent).toBe(false);
    const row = await db.rightsNotice.findUniqueOrThrow({
      where: { id: created.id },
      select: { status: true, urls: true, submittedById: true, targets: true },
    });
    expect(row.status).toBe("RECEIVED");
    expect(row.submittedById).toBeNull();
    expect(row.urls).toHaveLength(4);
    expect(row.targets.map((t) => [t.targetType, t.targetId, t.ownerId]).sort()).toEqual(
      [
        ["POST", ids.post, ids.seller],
        ["PRODUCT", ids.product, ids.seller],
      ].sort(),
    );
  });

  it("lo señalado de dos cuentas abre un caso para cada una: cada quien responde por lo suyo", async () => {
    ids.other = await createAccount("otra", "USER");
    const otherPost = await db.post.create({
      data: { authorId: ids.other, body: "La misma foto, en otra cuenta" },
      select: { id: true },
    });
    const { cases } = await submitAll([
      `http://localhost:3000/p/${ids.post}`,
      "https://otro.example/no-es-nuestro",
      `http://localhost:3000/p/${otherPost.id}`,
    ]);

    expect(cases).toHaveLength(2);
    expect(cases[1]!.number).toBeGreaterThan(cases[0]!.number);
    const rows = await db.rightsNotice.findMany({
      where: { id: { in: cases.map((item) => item.id) } },
      orderBy: { number: "asc" },
      select: {
        urls: true,
        claimantName: true,
        targets: { select: { targetId: true, ownerId: true } },
      },
    });
    expect(rows.map((row) => row.targets)).toEqual([
      [{ targetId: ids.post, ownerId: ids.seller }],
      [{ targetId: otherPost.id, ownerId: ids.other }],
    ]);
    expect(rows.map((row) => row.urls)).toEqual([
      [`http://localhost:3000/p/${ids.post}`, "https://otro.example/no-es-nuestro"],
      [`http://localhost:3000/p/${otherPost.id}`],
    ]);
    expect(rows.every((row) => row.claimantName === "Estudio Luz")).toBe(true);
  });

  it("solo el equipo decide, y lo que sigue de punta a punta", async () => {
    const created = await submit([
      `http://localhost:3000/p/${ids.post}`,
      `http://localhost:3000/producto/${ids.productSlug}`,
    ]);
    const number = created.number;

    await expect(
      rights.applyRightsAction(ids.seller, {
        action: "remove",
        noticeId: created.id,
        manualDone: false,
      }),
    ).rejects.toBeInstanceOf(AdminAuthorizationError);

    // Mientras no se retire nada, quien lo subió no ve el caso ni quién avisó (los números de caso
    // son consecutivos: no se pueden recorrer para conocer avisos pendientes o rechazados).
    expect(await rights.getOwnerCase(ids.seller, number)).toBeNull();
    await expect(
      rights.submitCounterNotice(
        ids.seller,
        counterNoticeInputSchema.parse({
          caseNumber: created.caseNumber,
          name: "Tienda de prueba",
          email: `e2e.fix.derechos.${RUN}.tienda@example.com`,
          domicile: "Calle 5 de Mayo 20, Centro, 68000, Oaxaca",
          basis: "OWN_WORK",
          explanation: "La foto la tomé yo; tengo el archivo original con sus datos.",
          swornStatement: "on",
          penaltyAcknowledged: "on",
        }),
        WEDNESDAY,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Retirar: oculta, bloquea los archivos, avisa en la campana y deja la bitácora.
    await rights.applyRightsAction(
      ids.admin,
      { action: "remove", noticeId: created.id, note: "Aviso completo", manualDone: false },
      WEDNESDAY,
    );
    expect(
      await db.post.findUniqueOrThrow({ where: { id: ids.post }, select: { status: true } }),
    ).toEqual({ status: "HIDDEN" });
    expect(
      await db.product.findUniqueOrThrow({
        where: { id: ids.product },
        select: { moderationStatus: true },
      }),
    ).toEqual({ moderationStatus: "HIDDEN" });
    const blocked = await db.blockedMediaHash.findMany({
      where: { sha256: { in: [hashes.post, hashes.product] } },
      select: { reason: true, noticeId: true },
    });
    expect(blocked).toHaveLength(2);
    expect(blocked.every((b) => b.reason === "RIGHTS_NOTICE" && b.noticeId === created.id)).toBe(
      true,
    );
    const removed = await db.rightsNotice.findUniqueOrThrow({ where: { id: created.id } });
    expect(removed).toMatchObject({
      status: "CONTENT_REMOVED",
      contentRemovedAt: WEDNESDAY,
      uploaderNotifiedAt: WEDNESDAY,
      decidedById: ids.admin,
      decisionNote: "Aviso completo",
    });
    const kinds = (
      await db.platformDecision.findMany({
        where: { approvedById: ids.admin },
        select: { kind: true },
      })
    ).map((d) => d.kind);
    expect(kinds).toEqual(
      expect.arrayContaining([
        "moderation.rights_hide_post",
        "moderation.rights_hide_product",
        "moderation.rights.remove",
      ]),
    );
    const bell = (await listNotifications(ids.seller)).filter((n) => n.type === "CONTENT_REMOVED");
    expect(bell).toHaveLength(1);
    expect(bell[0]!.rightsCase).toEqual({
      caseNumber: number,
      subject: "CONTENT",
      kind: "COPYRIGHT",
      event: "removed",
    });

    // Repetir no duplica nada: la etapa ya cambió.
    await expect(
      rights.applyRightsAction(ids.admin, {
        action: "remove",
        noticeId: created.id,
        manualDone: false,
      }),
    ).rejects.toMatchObject({ code: "NOT_ALLOWED" });

    // Quien lo subió ve SU caso, con quién avisó; nadie más lo ve.
    const view = await rights.getOwnerCase(ids.seller, number);
    expect(view).toMatchObject({
      canFile: true,
      claimant: { name: "Estudio Luz", email: `e2e.fix.derechos.${RUN}.estudio@example.com` },
    });
    expect(view!.targets).toHaveLength(2);
    expect(await rights.getOwnerCase(ids.admin, number)).toBeNull();

    // Contra-aviso: 10 días hábiles, uno por persona.
    const counter = counterNoticeInputSchema.parse({
      caseNumber: created.caseNumber,
      name: "Tienda de prueba",
      email: `e2e.fix.derechos.${RUN}.tienda@example.com`,
      domicile: "Calle 5 de Mayo 20, Centro, 68000, Oaxaca",
      basis: "OWN_WORK",
      explanation: "La foto la tomé yo; tengo el archivo original con sus datos.",
      swornStatement: "on",
      penaltyAcknowledged: "on",
    });
    await expect(rights.submitCounterNotice(ids.admin, counter, WEDNESDAY)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const filed = await rights.submitCounterNotice(ids.seller, counter, WEDNESDAY);
    expect(filed).toEqual({
      caseNumber: created.caseNumber,
      restoreDueAt: new Date("2026-10-21T10:00:00-06:00"),
      forwarded: false,
    });
    await expect(rights.submitCounterNotice(ids.seller, counter, WEDNESDAY)).rejects.toMatchObject({
      code: "ALREADY_FILED",
    });
    expect(await db.rightsNotice.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({
      status: "COUNTER_NOTICE_RECEIVED",
      counterNoticeAt: WEDNESDAY,
    });

    // Mientras corre el plazo cuenta como falta.
    const { open } = await rights.listNoticesForAdmin(ids.admin, WEDNESDAY);
    const listed = open.find((row) => row.id === created.id)!;
    expect(listed.owners.find((o) => o.userId === ids.seller)?.strikes).toBeGreaterThanOrEqual(1);
    expect(listed.restoreDue).toBe(false);

    // Restaurar antes del plazo exige nota; después restaura, desbloquea y avisa.
    await expect(
      rights.applyRightsAction(ids.admin, { action: "restore", noticeId: created.id }, WEDNESDAY),
    ).rejects.toMatchObject({ code: "NOTE_REQUIRED" });
    const after = new Date("2026-10-21T12:00:00-06:00");
    await rights.applyRightsAction(ids.admin, { action: "restore", noticeId: created.id }, after);
    expect(
      await db.post.findUniqueOrThrow({ where: { id: ids.post }, select: { status: true } }),
    ).toEqual({ status: "PUBLISHED" });
    expect(
      await db.product.findUniqueOrThrow({
        where: { id: ids.product },
        select: { moderationStatus: true },
      }),
    ).toEqual({ moderationStatus: "VISIBLE" });
    expect(
      await db.blockedMediaHash.count({ where: { sha256: { in: [hashes.post, hashes.product] } } }),
    ).toBe(0);
    expect(await db.rightsNotice.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({
      status: "RESTORED",
      restoredAt: after,
    });
    expect((await listNotifications(ids.seller)).some((n) => n.type === "CONTENT_RESTORED")).toBe(
      true,
    );

    // Quien avisó acredita una demanda dentro de sus 15 días hábiles: «Mantener retirado» vuelve a
    // retirarlo (oculta, bloquea los archivos y avisa que queda retirado).
    await db.notification.updateMany({
      where: { recipientId: ids.seller },
      data: { readAt: after },
    });
    const proof = new Date("2026-10-22T12:00:00-06:00");
    const kept = await rights.applyRightsAction(
      ids.admin,
      {
        action: "keep_down",
        noticeId: created.id,
        note: "Acreditó demanda, expediente 123/2026.",
        manualDone: false,
      },
      proof,
    );
    expect(kept.message).toMatch(/se volvió a retirar el contenido y se avisó/);
    expect(
      await db.post.findUniqueOrThrow({ where: { id: ids.post }, select: { status: true } }),
    ).toEqual({ status: "HIDDEN" });
    expect(
      await db.product.findUniqueOrThrow({
        where: { id: ids.product },
        select: { moderationStatus: true },
      }),
    ).toEqual({ moderationStatus: "HIDDEN" });
    expect(
      await db.blockedMediaHash.count({
        where: { sha256: { in: [hashes.post, hashes.product] }, noticeId: created.id },
      }),
    ).toBe(2);
    expect(await db.rightsNotice.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({
      status: "KEPT_DOWN",
      decisionNote: "Acreditó demanda, expediente 123/2026.",
    });
    const keptBell = (await listNotifications(ids.seller)).find(
      (n) => n.type === "CONTENT_REMOVED" && n.rightsCase?.event === "kept",
    );
    expect(keptBell).toMatchObject({ readAt: null, createdAt: proof });

    // La autoridad resuelve a favor de quien lo subió: restaurar otra vez renueva el mismo aviso.
    const resolved = new Date("2026-12-01T12:00:00-06:00");
    await rights.applyRightsAction(
      ids.admin,
      { action: "restore", noticeId: created.id, note: "Sentencia a favor de la tienda." },
      resolved,
    );
    const restoredBell = (await listNotifications(ids.seller)).filter(
      (n) => n.type === "CONTENT_RESTORED" && n.rightsCase?.caseNumber === number,
    );
    expect(restoredBell).toHaveLength(1);
    expect(restoredBell[0]).toMatchObject({ readAt: null, createdAt: resolved });
    expect(
      await db.post.findUniqueOrThrow({ where: { id: ids.post }, select: { status: true } }),
    ).toEqual({ status: "PUBLISHED" });
  });

  it("mantener retirado tras un contra-aviso deja oculto el contenido y avisa a quien lo subió", async () => {
    const post = await db.post.create({
      data: { authorId: ids.seller, body: "Mi canción favorita" },
      select: { id: true },
    });
    const created = await submit([`http://localhost:3000/p/${post.id}`]);
    await rights.applyRightsAction(
      ids.admin,
      { action: "remove", noticeId: created.id, manualDone: false },
      WEDNESDAY,
    );
    await rights.submitCounterNotice(
      ids.seller,
      counterNoticeInputSchema.parse({
        caseNumber: created.caseNumber,
        name: "Tienda de prueba",
        email: `e2e.fix.derechos.${RUN}.tienda@example.com`,
        domicile: "Calle 5 de Mayo 20, Centro, 68000, Oaxaca",
        basis: "EXCEPTION",
        explanation: "Es una cita breve con crédito dentro de una reseña.",
        swornStatement: "on",
        penaltyAcknowledged: "on",
      }),
      WEDNESDAY,
    );

    const result = await rights.applyRightsAction(
      ids.admin,
      { action: "keep_down", noticeId: created.id, note: "Acreditó denuncia.", manualDone: false },
      new Date("2026-10-09T12:00:00-06:00"),
    );

    expect(result.message).toMatch(/se mantiene retirado y se avisó/);
    expect(
      await db.post.findUniqueOrThrow({ where: { id: post.id }, select: { status: true } }),
    ).toEqual({ status: "HIDDEN" });
    const bell = (await listNotifications(ids.seller)).find(
      (n) => n.rightsCase?.caseNumber === created.number && n.rightsCase.event === "kept",
    );
    expect(bell?.type).toBe("CONTENT_REMOVED");
    // Ya no procede otro contra-aviso; el caso sigue abierto a «Restaurar».
    expect(await rights.getOwnerCase(ids.seller, created.number)).toMatchObject({
      status: "KEPT_DOWN",
      canFile: false,
    });
  });

  it("dos avisos sobre lo mismo: cerrar uno no restaura lo que el otro mantiene retirado", async () => {
    const photo = await media(ids.seller, hashes.twice);
    const post = await db.post.create({
      data: {
        authorId: ids.seller,
        body: "Foto repetida",
        media: { create: [{ mediaId: photo.id }] },
      },
      select: { id: true },
    });
    const url = `http://localhost:3000/p/${post.id}`;
    const first = await submit([url]);
    const second = await submit([url]);
    for (const created of [first, second]) {
      await rights.applyRightsAction(ids.admin, {
        action: "remove",
        noticeId: created.id,
        manualDone: false,
      });
    }

    const withdrawn = await rights.applyRightsAction(ids.admin, {
      action: "withdraw",
      noticeId: first.id,
    });

    expect(withdrawn.message).toContain(
      `sigue retirada por otro aviso vigente (${second.caseNumber})`,
    );
    expect(
      await db.post.findUniqueOrThrow({ where: { id: post.id }, select: { status: true } }),
    ).toEqual({ status: "HIDDEN" });
    // El archivo sigue bloqueado, ahora a nombre del aviso que sigue vigente.
    expect(
      await db.blockedMediaHash.findUnique({
        where: { sha256: hashes.twice },
        select: { noticeId: true },
      }),
    ).toEqual({ noticeId: second.id });

    await rights.applyRightsAction(ids.admin, {
      action: "restore",
      noticeId: second.id,
      note: "Quien avisó no era titular.",
    });
    expect(
      await db.post.findUniqueOrThrow({ where: { id: post.id }, select: { status: true } }),
    ).toEqual({ status: "PUBLISHED" });
    expect(await db.blockedMediaHash.count({ where: { sha256: hashes.twice } })).toBe(0);
  });

  it("restaurar no toca lo que otra decisión de moderación ocultó antes", async () => {
    await applyModerationAction(ids.admin, {
      action: "hide",
      targetType: "POST",
      targetId: ids.otherPost,
      note: "Reporte de spam",
    });
    const created = await submit([`http://localhost:3000/p/${ids.otherPost}`]);
    await rights.applyRightsAction(ids.admin, {
      action: "remove",
      noticeId: created.id,
      manualDone: false,
    });
    const result = await rights.applyRightsAction(ids.admin, {
      action: "withdraw",
      noticeId: created.id,
    });

    expect(result.message).toMatch(/no se tocó/);
    expect(
      await db.post.findUniqueOrThrow({ where: { id: ids.otherPost }, select: { status: true } }),
    ).toEqual({ status: "HIDDEN" });
    expect(await db.rightsNotice.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({
      status: "WITHDRAWN",
    });
  });

  it("un aviso rechazado no le muestra a quien subió el contenido quién avisó", async () => {
    const created = await submit([`http://localhost:3000/p/${ids.otherPost}`]);
    await rights.applyRightsAction(ids.admin, {
      action: "reject",
      noticeId: created.id,
      note: "Quien avisó no acreditó ningún derecho.",
    });

    expect(await rights.getOwnerCase(ids.seller, created.number)).toBeNull();
  });

  it("sin nada de speeaking no hay qué retirar; rechazar exige estar recibido", async () => {
    const created = await submit(["https://otro.example/x"]);
    expect(created.targetCount).toBe(0);

    await expect(
      rights.applyRightsAction(ids.admin, {
        action: "remove",
        noticeId: created.id,
        manualDone: false,
      }),
    ).rejects.toMatchObject({ code: "NO_TARGETS" });
    await rights.applyRightsAction(ids.admin, {
      action: "reject",
      noticeId: created.id,
      note: "Las direcciones no son de speeaking.",
    });
    expect(await db.rightsNotice.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({
      status: "REJECTED",
      decisionNote: "Las direcciones no son de speeaking.",
    });
    await expect(
      rights.applyRightsAction(ids.admin, {
        action: "reject",
        noticeId: created.id,
        note: "otra vez",
      }),
    ).rejects.toMatchObject({ code: "NOT_ALLOWED" });
  });

  it("una foto de perfil se retira a mano: el equipo lo confirma antes", async () => {
    const profile = await db.profile.findUniqueOrThrow({
      where: { userId: ids.seller },
      select: { username: true },
    });
    const created = await submit([`http://localhost:3000/u/${profile.username}`]);
    expect(created.targetCount).toBe(1);

    await expect(
      rights.applyRightsAction(ids.admin, {
        action: "remove",
        noticeId: created.id,
        manualDone: false,
      }),
    ).rejects.toMatchObject({ code: "MANUAL_PENDING" });
    await rights.applyRightsAction(ids.admin, {
      action: "remove",
      noticeId: created.id,
      manualDone: true,
    });
    const bell = await listNotifications(ids.seller);
    expect(
      bell.find((n) => n.type === "CONTENT_REMOVED" && n.rightsCase?.caseNumber === created.number)
        ?.rightsCase,
    ).toEqual({
      caseNumber: created.number,
      subject: "CONTENT",
      kind: "COPYRIGHT",
      event: "removed",
    });
  });
});
