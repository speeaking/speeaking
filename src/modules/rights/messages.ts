import type { CounterNoticeBasis, RightsNoticeKind } from "@/generated/prisma/enums";
import { siteConfig } from "@/config/site";
import { caseNumbersSentence, formatCaseList, formatCaseNumber } from "./case-number";
import { COUNTER_NOTICE_BASIS_LABELS, RIGHTS_KIND_PHRASE, RIGHTS_KIND_SHORT } from "./labels";
import type { RightsSubject } from "./notification-key";

/**
 * Textos de los correos del aviso de derechos (ADR-076). Código puro: el equipo ve la misma copia
 * del contra-aviso en /admin/avisos para mandarla a mano cuando no hay proveedor de correo.
 */
export type EmailText = { subject: string; text: string };

const longDate = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "long",
  timeZone: siteConfig.timeZone,
});

export function formatLegalDate(date: Date): string {
  return longDate.format(date);
}

const SUBJECT_NOUNS: Record<RightsSubject, string> = {
  POST: "tu publicación",
  PRODUCT: "tu producto",
  CONTENT: "tu contenido",
};

/**
 * Acuse a quien avisa. Va a un correo que nadie verificó (el formulario es público), así que no
 * repite nada de lo que se escribió: ni direcciones ni textos, solo los números de caso y datos
 * nuestros. Si no, el formulario serviría para mandar enlaces a un tercero desde nuestro remitente.
 */
export function noticeAcknowledgementEmail(input: {
  numbers: readonly number[];
  kind: RightsNoticeKind;
  receivedAt: Date;
  urlCount: number;
}): EmailText {
  const list = formatCaseList(input.numbers);
  return {
    subject:
      input.numbers.length === 1
        ? `Recibimos tu aviso ${list}`
        : `Recibimos tu aviso (casos ${list})`,
    text: [
      `Recibimos tu aviso en ${siteConfig.name}. ${caseNumbersSentence(input.numbers)}`,
      "",
      `Tipo: ${RIGHTS_KIND_SHORT[input.kind]}`,
      `Recibido el: ${formatLegalDate(input.receivedAt)}`,
      `Direcciones que señalaste: ${input.urlCount}`,
      "",
      "Si no mandaste este aviso, ignora este correo.",
      "",
      "Qué sigue: lo revisamos y, si está completo, retiramos el contenido sin demora y avisamos a quien lo subió. Esa persona recibe tu nombre, tu correo y la descripción de tu aviso. Si manda un contra-aviso, te enviaremos una copia.",
      "",
      "Un aviso falso puede recibir una multa de 1,000 a 20,000 UMA (Ley Federal del Derecho de Autor, art. 232 Quinquies).",
    ].join("\n"),
  };
}

export function counterNoticeCopyEmail(input: {
  number: number;
  counter: {
    name: string;
    email: string;
    domicile: string;
    basis: CounterNoticeBasis;
    explanation: string;
    createdAt: Date;
  };
  restoreDueAt: Date;
}): EmailText {
  const caseNumber = formatCaseNumber(input.number);
  const { counter } = input;
  return {
    subject: `Contra-aviso en tu caso ${caseNumber}`,
    text: [
      `Quien subió el contenido que señalaste en tu aviso ${caseNumber} mandó un contra-aviso. Por ley te enviamos esta copia (Ley Federal del Derecho de Autor, art. 114 Octies, fracción III).`,
      "",
      `Nombre: ${counter.name}`,
      `Correo: ${counter.email}`,
      `Domicilio: ${counter.domicile}`,
      `Fundamento: ${COUNTER_NOTICE_BASIS_LABELS[counter.basis]}`,
      "Explicación:",
      counter.explanation,
      `Recibido el: ${formatLegalDate(counter.createdAt)}`,
      "Declaró bajo protesta de decir verdad que la información es cierta y que conoce la multa por contra-avisos falsos.",
      "",
      `Qué sigue: volveremos a mostrar el contenido a partir del ${formatLegalDate(input.restoreDueAt)}. Si dentro de los 15 días hábiles siguientes a esta copia nos compruebas que iniciaste un juicio, un procedimiento administrativo, una denuncia penal o un medio alterno de solución (como la avenencia, la mediación o el arbitraje ante el INDAUTOR), no lo restauraremos o lo volveremos a retirar. Responde a este correo con el comprobante y el número de caso.`,
    ].join("\n"),
  };
}

export function contentRemovedEmail(input: {
  number: number;
  kind: RightsNoticeKind;
  subject: RightsSubject;
  caseUrl: string;
}): EmailText {
  const caseNumber = formatCaseNumber(input.number);
  return {
    subject: `Retiramos ${SUBJECT_NOUNS[input.subject]} (caso ${caseNumber})`,
    text: [
      `Retiramos ${SUBJECT_NOUNS[input.subject]} de ${siteConfig.name} por un aviso ${RIGHTS_KIND_PHRASE[input.kind]} (caso ${caseNumber}).`,
      "",
      `Quién mandó el aviso, qué reclama y cómo mandar un contra-aviso: ${input.caseUrl}`,
      "",
      "Si es tuyo, tienes permiso o es un uso permitido por la ley, puedes mandar un contra-aviso. Lo retirado por avisos que no se revierten cuenta para nuestra política de reincidencia.",
    ].join("\n"),
  };
}

const SUBJECT_KEPT: Record<RightsSubject, string> = {
  POST: "Tu publicación queda retirada",
  PRODUCT: "Tu producto queda retirado",
  CONTENT: "Tu contenido queda retirado",
};

/** «Mantener retirado»: quien avisó acreditó una acción legal (RLFDA art. 37 Nonies). */
export function contentKeptDownEmail(input: {
  number: number;
  subject: RightsSubject;
  caseUrl: string;
}): EmailText {
  const caseNumber = formatCaseNumber(input.number);
  return {
    subject: `${SUBJECT_KEPT[input.subject]} (caso ${caseNumber})`,
    text: [
      `${SUBJECT_KEPT[input.subject]} en ${siteConfig.name} (caso ${caseNumber}): quien mandó el aviso comprobó que inició una acción legal (un juicio, un procedimiento administrativo, una denuncia penal o un medio alterno de solución).`,
      "",
      `Sigue retirado mientras las autoridades lo resuelven; ${siteConfig.name} no decide quién tiene la razón. Detalle del caso: ${input.caseUrl}`,
    ].join("\n"),
  };
}
