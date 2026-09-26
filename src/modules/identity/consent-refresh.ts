import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { LEGAL_VERSIONS } from "./constants";

/**
 * Volver a aceptar los documentos legales cuando cambian. Al registrarse, la persona acepta los
 * términos y el aviso de privacidad vigentes (`UserConsent` con su versión). Si después se sube
 * `LEGAL_VERSIONS.terms` o `LEGAL_VERSIONS.privacyNotice`, quien aceptó una versión anterior ve un
 * aviso que no bloquea (`components/consent-banner.tsx`) y, al tocar «Aceptar», se agregan filas
 * nuevas con la versión que el aviso le MOSTRÓ, si sigue siendo la vigente: el historial solo crece y
 * nunca registra como aceptada una versión que la persona no vio (p. ej. una publicada mientras tenía
 * la pestaña abierta).
 */

/** Documentos que se vuelven a aceptar, en el orden en que se mencionan en el aviso. */
export const REFRESHABLE_CONSENTS = ["PRIVACY_NOTICE", "TERMS"] as const;
export type RefreshableConsent = (typeof REFRESHABLE_CONSENTS)[number];

/** Documento con una versión vigente que la persona aún no acepta (seguro para el cliente). */
export type PendingLegalDocument = { type: RefreshableConsent; version: string };

/** Lo último que la persona registró de un documento (`null`: nunca lo aceptó). */
export type LatestConsent = { version: string; granted: boolean } | null;

type LegalVersions = { terms: string; privacyNotice: string };

export function currentLegalVersion(
  type: RefreshableConsent,
  versions: LegalVersions = LEGAL_VERSIONS,
): string {
  return type === "TERMS" ? versions.terms : versions.privacyNotice;
}

/** Versión con forma de fecha («2026-09-27»): entre dos así, el orden de texto es el cronológico. */
const DATE_VERSION = /^\d{4}-\d{2}-\d{2}$/;

/**
 * ¿Hay que pedirle a la persona que acepte la versión vigente? Sí si nunca aceptó el documento, si
 * lo último que registró fue retirarlo, o si aceptó una versión ANTERIOR. Una versión posterior a la
 * vigente (p. ej. tras regresar el código a una versión previa) no vuelve a preguntar. Si alguna
 * versión no tiene forma de fecha, solo cuenta si es distinta.
 */
export function isOutdatedConsent(latest: LatestConsent | undefined, current: string): boolean {
  if (!latest || !latest.granted) return true;
  if (DATE_VERSION.test(latest.version) && DATE_VERSION.test(current)) {
    return latest.version < current;
  }
  return latest.version !== current;
}

/** Documentos por aceptar dada la última fila de cada uno. */
export function pendingLegalDocuments(
  latest: Partial<Record<RefreshableConsent, LatestConsent>>,
  versions: LegalVersions = LEGAL_VERSIONS,
): PendingLegalDocument[] {
  return REFRESHABLE_CONSENTS.flatMap((type) => {
    const version = currentLegalVersion(type, versions);
    return isOutdatedConsent(latest[type], version) ? [{ type, version }] : [];
  });
}

type Client = Prisma.TransactionClient | typeof db;

/**
 * Última fila de cada documento (índice `userId, type, createdAt`). Una tras otra: dentro de una
 * transacción no se pueden encimar consultas en la misma conexión.
 */
async function latestConsents(
  userId: string,
  client: Client,
): Promise<Record<RefreshableConsent, LatestConsent>> {
  const latest = (type: RefreshableConsent) =>
    client.userConsent.findFirst({
      where: { userId, type },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { version: true, granted: true },
    });
  const privacyNotice = await latest("PRIVACY_NOTICE");
  const terms = await latest("TERMS");
  return { PRIVACY_NOTICE: privacyNotice, TERMS: terms };
}

/** Documentos que la persona debe volver a aceptar (vacío si está al día). */
export async function getPendingLegalDocuments(
  userId: string,
  client: Client = db,
): Promise<PendingLegalDocument[]> {
  return pendingLegalDocuments(await latestConsents(userId, client));
}

/**
 * Lo que el aviso le mostró a la persona. Llega del navegador (argumento de la Server Action): se
 * valida y solo sirve para comparar, nunca decide qué versión se registra.
 */
export const shownLegalDocumentsSchema = z
  .array(z.strictObject({ type: z.enum(REFRESHABLE_CONSENTS), version: z.string().min(1).max(40) }))
  .max(REFRESHABLE_CONSENTS.length);

export type AcceptPendingResult = {
  /** Lo que se registró: pendiente y con la misma versión que se le mostró. */
  accepted: PendingLegalDocument[];
  /** Pendiente con una versión que el aviso no le mostró (cambió mientras tanto): no se registra. */
  stale: PendingLegalDocument[];
};

/**
 * Registra la aceptación de lo pendiente que la persona vio en el aviso (misma versión vigente). Si
 * ya estaba al día (p. ej. aceptó en otra pestaña), no escribe nada; con un candado por persona, dos
 * «Aceptar» simultáneos (dos pestañas) tampoco repiten filas. Lo pendiente con otra versión que la
 * mostrada queda en `stale`: hay que volver a mostrar el aviso.
 */
export async function acceptPendingLegalDocuments(
  userId: string,
  shown: readonly PendingLegalDocument[],
): Promise<AcceptPendingResult> {
  const seen = new Set(shown.map(documentKey));
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`consent-refresh:${userId}`}, 0))`;
    const pending = await getPendingLegalDocuments(userId, tx);
    const accepted = pending.filter((document) => seen.has(documentKey(document)));
    const stale = pending.filter((document) => !seen.has(documentKey(document)));
    if (accepted.length > 0) {
      await tx.userConsent.createMany({
        data: accepted.map((document) => ({
          userId,
          type: document.type,
          version: document.version,
          granted: true,
        })),
      });
    }
    return { accepted, stale };
  });
}

function documentKey(document: PendingLegalDocument) {
  return `${document.type}@${document.version}`;
}
