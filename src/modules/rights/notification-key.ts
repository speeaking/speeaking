import type { ReportTargetType, RightsNoticeKind } from "@/generated/prisma/enums";

/**
 * Avisos de la campana por un aviso de derechos (CONTENT_REMOVED / CONTENT_RESTORED, ADR-076). La
 * tabla `notifications` no tiene columna para el caso, así que viaja en `dedupeKey`, que además
 * garantiza uno por persona, caso y evento aunque la acción se repita (si el evento vuelve a pasar,
 * el mismo aviso se renueva):
 * `rights:<número>:<removed|restored|kept>:<post|product|content>:<copyright|trademark|performer_image>:<persona>`.
 * Código puro: lo escribe `rights/queries.ts` y lo lee `notifications/queries.ts`.
 *
 * `removed` y `kept` van con `CONTENT_REMOVED`: `kept` es «se mantiene retirado» (quien avisó
 * acreditó una acción legal), también cuando se vuelve a retirar lo restaurado; `restored`, con
 * `CONTENT_RESTORED`.
 */
export type RightsNotificationEvent = "removed" | "restored" | "kept";
/** Qué se retiró: una publicación, un producto o varias cosas (o una foto de perfil). */
export type RightsSubject = "POST" | "PRODUCT" | "CONTENT";
export type RightsCaseRef = {
  caseNumber: number;
  subject: RightsSubject;
  kind: RightsNoticeKind;
  /** Sin él se lee como el evento de siempre de su tipo (`removed` o `restored`). */
  event?: RightsNotificationEvent;
};

const SUBJECTS: readonly RightsSubject[] = ["POST", "PRODUCT", "CONTENT"];
const KINDS: readonly RightsNoticeKind[] = ["COPYRIGHT", "TRADEMARK", "PERFORMER_IMAGE"];
const EVENTS: readonly RightsNotificationEvent[] = ["removed", "restored", "kept"];

export function rightsNotificationKey(input: {
  caseNumber: number;
  event: RightsNotificationEvent;
  subject: RightsSubject;
  kind: RightsNoticeKind;
  recipientId: string;
}): string {
  return [
    "rights",
    input.caseNumber,
    input.event,
    input.subject.toLowerCase(),
    input.kind.toLowerCase(),
    input.recipientId,
  ].join(":");
}

export function parseRightsNotificationKey(
  key: string | null | undefined,
): (RightsCaseRef & { event: RightsNotificationEvent }) | null {
  const match = /^rights:(\d{1,10}):([a-z]+):([a-z]+):([a-z_]+):[0-9a-f-]{36}$/.exec(key ?? "");
  if (!match) return null;
  const caseNumber = Number(match[1]);
  const event = EVENTS.find((value) => value === match[2]);
  const subject = SUBJECTS.find((value) => value.toLowerCase() === match[3]);
  const kind = KINDS.find((value) => value.toLowerCase() === match[4]);
  if (!Number.isSafeInteger(caseNumber) || caseNumber < 1 || !event || !subject || !kind) {
    return null;
  }
  return { caseNumber, event, subject, kind };
}

/** «Tu publicación» o «tu producto» solo si todo lo de esa persona en el caso es de ese tipo. */
export function rightsSubject(targetTypes: readonly ReportTargetType[]): RightsSubject {
  if (targetTypes.length > 0 && targetTypes.every((type) => type === "POST")) return "POST";
  if (targetTypes.length > 0 && targetTypes.every((type) => type === "PRODUCT")) return "PRODUCT";
  return "CONTENT";
}
