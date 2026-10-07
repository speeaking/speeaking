import type {
  CounterNoticeBasis,
  RightsClaimantRole,
  RightsNoticeKind,
  RightsNoticeStatus,
} from "@/generated/prisma/enums";

/** Qué derecho se reclama, como lo elige quien avisa. */
export const RIGHTS_KIND_LABELS: Record<RightsNoticeKind, string> = {
  COPYRIGHT: "Derechos de autor (foto, video, música, texto u otra obra)",
  TRADEMARK: "Marca registrada en el IMPI",
  PERFORMER_IMAGE: "Imagen o voz de una persona artista intérprete",
};

/** Lo mismo, corto (listas del equipo). */
export const RIGHTS_KIND_SHORT: Record<RightsNoticeKind, string> = {
  COPYRIGHT: "Derechos de autor",
  TRADEMARK: "Marca",
  PERFORMER_IMAGE: "Imagen o voz de artista",
};

/** «Retiramos tu publicación por un aviso …» */
export const RIGHTS_KIND_PHRASE: Record<RightsNoticeKind, string> = {
  COPYRIGHT: "de derechos de autor",
  TRADEMARK: "de marca",
  PERFORMER_IMAGE: "sobre la imagen o la voz de una persona artista",
};

export const CLAIMANT_ROLE_LABELS: Record<RightsClaimantRole, string> = {
  OWNER: "Soy titular del derecho",
  REPRESENTATIVE: "Represento a quien es titular",
};

export const RIGHTS_STATUS_LABELS: Record<RightsNoticeStatus, string> = {
  RECEIVED: "Recibido, en revisión",
  CONTENT_REMOVED: "Contenido retirado",
  COUNTER_NOTICE_RECEIVED: "Contra-aviso recibido",
  RESTORED: "Contenido restaurado",
  KEPT_DOWN: "Se mantiene retirado",
  REJECTED: "No procede",
  WITHDRAWN: "Retirado por quien avisó",
};

export const COUNTER_NOTICE_BASIS_LABELS: Record<CounterNoticeBasis, string> = {
  OWN_WORK: "La obra es mía",
  LICENSE: "Tengo licencia o permiso de quien es titular",
  EXCEPTION:
    "Es un uso permitido sin autorización (LFDA art. 148: cita breve con crédito, crítica o reseña, noticia, obra visible en un lugar público…)",
  PUBLIC_DOMAIN: "La obra es de dominio público",
};
