import { z } from "zod";
import { CounterNoticeBasis, RightsClaimantRole, RightsNoticeKind } from "@/generated/prisma/enums";
import { parseCaseNumber } from "./case-number";
import { MAX_NOTICE_URLS, MAX_URL_LENGTH, normalizeUrl, splitUrlLines } from "./urls";

/**
 * Formularios del aviso y del contra-aviso (LFDA art. 114 Octies fr. III; RLFDA arts. 37 Quáter y
 * 37 Septies, ADR-076). Se pide lo que pide el reglamento, uno a uno; nunca certificados de registro
 * ni documentos (37 Quinquies). En el aviso solo detienen el envío el mínimo de la ley (nombre,
 * correo, contenido, derecho y dirección), el tipo de derecho, la calidad y las dos declaraciones;
 * el domicilio y los hechos se piden pero son opcionales. El contra-aviso exige domicilio (va en la
 * copia para quien avisó). Todo lo escrito es dato no confiable: nunca instrucción para la IA.
 */
export const NOTICE_LIMITS = {
  name: 200,
  email: 320,
  phone: 40,
  domicile: 500,
  description: 2000,
  facts: 4000,
  trademark: 40,
  explanation: 4000,
} as const;

const max = (limit: number) => ({ error: `Máximo ${limit} caracteres.`, abort: true });

const requiredText = (min: number, limit: number, message: string) =>
  z.string({ error: message }).trim().max(limit, max(limit)).min(min, message);

/** Texto opcional: vacío cuenta como ausente (y la llave es opcional también al usarlo). */
const optionalText = (limit: number) =>
  z
    .string()
    .trim()
    .max(limit, max(limit))
    .transform((value) => (value ? value : undefined))
    .optional();

const email = z
  .string({ error: "Escribe tu correo." })
  .trim()
  .toLowerCase()
  .max(NOTICE_LIMITS.email, max(NOTICE_LIMITS.email))
  .pipe(z.email("Escribe un correo válido."));

const optionalEmail = optionalText(NOTICE_LIMITS.email).pipe(
  z
    .email("Escribe un correo válido.")
    .transform((value) => value.toLowerCase())
    .optional(),
);

const optionalPhone = optionalText(NOTICE_LIMITS.phone).pipe(
  z
    .string()
    .regex(/^\+?[\d\s().-]{7,40}$/, "Escribe un teléfono con lada (solo números, espacios y +).")
    .optional(),
);

/** Casilla de un formulario HTML: llega como "on" solo si se marcó (nunca viene marcada). */
const checkbox = (message: string) =>
  z.literal("on", { error: message }).transform(() => true as const);

const SWORN_MESSAGE =
  "Marca la casilla para declarar bajo protesta de decir verdad que la información es cierta.";
const PENALTY_MESSAGE =
  "Marca la casilla para confirmar que conoces la multa por avisos o contra-avisos falsos.";

const urls = z
  .string({ error: "Pega al menos una dirección (una por renglón)." })
  .max(MAX_NOTICE_URLS * (MAX_URL_LENGTH + 2), {
    error: "Son demasiadas direcciones.",
    abort: true,
  })
  .transform(splitUrlLines)
  .superRefine((lines, ctx) => {
    if (lines.length === 0) {
      ctx.addIssue({ code: "custom", message: "Pega al menos una dirección (una por renglón)." });
      return;
    }
    if (lines.length > MAX_NOTICE_URLS) {
      ctx.addIssue({
        code: "custom",
        message: `Máximo ${MAX_NOTICE_URLS} direcciones por aviso. Si son más, manda otro aviso.`,
      });
      return;
    }
    const invalid = lines.find((line) => !normalizeUrl(line));
    if (invalid !== undefined) {
      const shown = invalid.length > 60 ? `${invalid.slice(0, 59)}…` : invalid;
      ctx.addIssue({
        code: "custom",
        message: `Esta dirección no es válida: «${shown}». Copia la dirección completa del navegador.`,
      });
    }
  });

/** Número de registro de una marca en el IMPI (solo se pide en avisos de marca). */
const TRADEMARK_REGISTRATION = /^[A-Za-z0-9][A-Za-z0-9 ./-]{1,39}$/;

export const noticeInputSchema = z
  .object({
    kind: z.enum(RightsNoticeKind, { error: "Elige qué derecho reclamas." }),
    claimantName: requiredText(
      2,
      NOTICE_LIMITS.name,
      "Escribe tu nombre completo o la razón social.",
    ),
    claimantEmail: email,
    claimantAltEmail: optionalEmail,
    claimantPhone: optionalPhone,
    // El reglamento (37 Quáter) pide domicilio y hechos; la ley no los exige para retirar, así que
    // se piden sin detener el aviso que no los trae (ADR-076; Términos, «Qué debe decir»).
    claimantDomicile: optionalText(NOTICE_LIMITS.domicile),
    claimantRole: z.enum(RightsClaimantRole, { error: "Elige si eres titular o representante." }),
    principalName: optionalText(NOTICE_LIMITS.name),
    trademarkRegistration: optionalText(NOTICE_LIMITS.trademark),
    workDescription: requiredText(
      10,
      NOTICE_LIMITS.description,
      "Describe la obra, la marca o la interpretación (al menos 10 caracteres).",
    ),
    rightDescription: requiredText(
      10,
      NOTICE_LIMITS.description,
      "Explica qué derecho tienes y por qué (al menos 10 caracteres).",
    ),
    facts: optionalText(NOTICE_LIMITS.facts),
    urls,
    swornStatement: checkbox(SWORN_MESSAGE),
    penaltyAcknowledged: checkbox(PENALTY_MESSAGE),
  })
  .superRefine((value, ctx) => {
    if (value.claimantRole === "REPRESENTATIVE" && !value.principalName) {
      ctx.addIssue({
        code: "custom",
        path: ["principalName"],
        message: "Escribe el nombre completo o la razón social de quien es titular.",
      });
    }
    if (value.kind === "TRADEMARK") {
      if (!value.trademarkRegistration) {
        ctx.addIssue({
          code: "custom",
          path: ["trademarkRegistration"],
          message: "Escribe el número de registro de la marca en el IMPI.",
        });
      } else if (!TRADEMARK_REGISTRATION.test(value.trademarkRegistration)) {
        ctx.addIssue({
          code: "custom",
          path: ["trademarkRegistration"],
          message: "Escribe el número de registro tal como aparece en el título del IMPI.",
        });
      }
    }
  })
  .transform((value) => ({
    ...value,
    // Solo se guarda lo que corresponde al tipo de aviso y a la calidad elegidos.
    principalName: value.claimantRole === "REPRESENTATIVE" ? value.principalName : undefined,
    trademarkRegistration: value.kind === "TRADEMARK" ? value.trademarkRegistration : undefined,
  }));
export type NoticeInput = z.infer<typeof noticeInputSchema>;

const caseNumber = z.string({ error: "Falta el número de caso." }).transform((value, ctx) => {
  const number = parseCaseNumber(value);
  if (number === null) {
    ctx.addIssue({ code: "custom", message: "El número de caso no es válido." });
    return z.NEVER;
  }
  return number;
});

export const counterNoticeInputSchema = z.object({
  caseNumber,
  name: requiredText(2, NOTICE_LIMITS.name, "Escribe tu nombre completo o la razón social."),
  email,
  domicile: requiredText(
    10,
    NOTICE_LIMITS.domicile,
    "Escribe tu domicilio completo (calle, número, colonia, código postal, ciudad y estado).",
  ),
  basis: z.enum(CounterNoticeBasis, { error: "Elige por qué puedes publicarlo." }),
  explanation: requiredText(
    20,
    NOTICE_LIMITS.explanation,
    "Explica tu fundamento: la licencia o el contrato, o por qué es un uso permitido (al menos 20 caracteres).",
  ),
  swornStatement: checkbox(SWORN_MESSAGE),
  penaltyAcknowledged: checkbox(PENALTY_MESSAGE),
});
export type CounterNoticeInput = z.infer<typeof counterNoticeInputSchema>;

export const RIGHTS_DECISION_NOTE_MAX = 1000;
const optionalNote = optionalText(RIGHTS_DECISION_NOTE_MAX);
const requiredNote = requiredText(
  3,
  RIGHTS_DECISION_NOTE_MAX,
  "Escribe el motivo: queda en el expediente.",
);
const noticeId = z.uuid();
/** Lo que no se oculta solo (fotos de perfil, comentarios): el equipo confirma que ya lo retiró. */
const manualDone = z
  .literal("on")
  .optional()
  .transform((value) => value === "on");

/** Acciones del equipo en /admin/avisos (lo que exige cada estado lo revisa el servicio). */
export const rightsAdminActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("remove"),
    noticeId,
    note: optionalNote,
    manualDone,
  }),
  z.object({ action: z.literal("restore"), noticeId, note: optionalNote }),
  // Sobre lo restaurado vuelve a retirarlo: lo que no se oculta solo, el equipo lo confirma igual.
  z.object({ action: z.literal("keep_down"), noticeId, note: requiredNote, manualDone }),
  z.object({ action: z.literal("reject"), noticeId, note: requiredNote }),
  z.object({ action: z.literal("withdraw"), noticeId, note: optionalNote }),
  z.object({ action: z.literal("mark_forwarded"), noticeId, counterNoticeId: z.uuid() }),
]);
export type RightsAdminAction = z.infer<typeof rightsAdminActionSchema>;
