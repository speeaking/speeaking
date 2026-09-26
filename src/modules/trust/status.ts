import type { Authenticity, AuthenticityStatus, RiskLevel } from "@/generated/prisma/enums";
import {
  type BuyerAuthenticityClaim,
  REVIEWED_DETAIL,
  REVIEWED_LABEL,
  UNVERIFIED_DETAIL,
  UNVERIFIED_LABEL,
} from "./buyer-copy";
import type { RuleId } from "./rules";
import { WEIGHTS } from "./rules";

export { REVIEWED_LABEL, UNVERIFIED_LABEL } from "./buyer-copy";

/**
 * Estado de la revisión de autenticidad al reevaluar un producto (crear, editar, un reporte nuevo,
 * la señal de la IA). Puro y probado: las decisiones del equipo (verificar, rechazar) no se
 * deshacen solas.
 *
 * - Riesgo alto → se pide prueba (NEEDS_PROOF), o queda «en revisión» si ya había fotos de prueba.
 * - Riesgo bajo o medio → AUTO_CLEAR (el riesgo medio solo agrega una nota neutral para quien compra).
 * - VERIFIED_BY_ADMIN se conserva mientras el producto siga declarado original, el riesgo no suba
 *   respecto al que el equipo revisó (`frozen`: no se reescriben puntaje ni señales) y no cambie QUÉ
 *   se vende (`listingChanged`: título, etiquetas, categoría o condición). El comprobante se revisó
 *   para ese artículo: si el vendedor lo cambia por otro, el sello no se hereda. Si sube el riesgo o
 *   cambia el artículo, se reevalúa como cualquier otro (con riesgo alto vuelve a la cola con las
 *   pruebas que ya había).
 * - REJECTED se conserva mientras el producto no vuelva a declararse original; si el vendedor lo
 *   vuelve a declarar, se le pide otra prueba.
 */
export type CurrentCheck = { status: AuthenticityStatus; score: number; proofCount: number };

export type NextCheck = { status: AuthenticityStatus; frozen: boolean };

export function nextCheckStatus({
  current,
  level,
  score,
  authenticity,
  listingChanged = false,
}: {
  current: CurrentCheck | null;
  level: RiskLevel;
  score: number;
  authenticity: Authenticity;
  /** El vendedor cambió qué vende (título, etiquetas, categoría o condición) en esta edición. */
  listingChanged?: boolean;
}): NextCheck {
  const high = level === "HIGH";
  const declared = authenticity === "DECLARED_ORIGINAL";
  const proofs = current?.proofCount ?? 0;
  const askForProof = (): AuthenticityStatus => (proofs > 0 ? "PROOF_SUBMITTED" : "NEEDS_PROOF");

  switch (current?.status) {
    case "VERIFIED_BY_ADMIN":
      if (declared && !listingChanged && score <= current.score) {
        return { status: "VERIFIED_BY_ADMIN", frozen: true };
      }
      return { status: high ? askForProof() : "AUTO_CLEAR", frozen: false };
    case "REJECTED":
      return { status: declared ? "NEEDS_PROOF" : "REJECTED", frozen: false };
    case "NEEDS_PROOF":
      return { status: high ? "NEEDS_PROOF" : "AUTO_CLEAR", frozen: false };
    case "PROOF_SUBMITTED":
      return { status: high ? "PROOF_SUBMITTED" : "AUTO_CLEAR", frozen: false };
    default:
      return { status: high ? askForProof() : "AUTO_CLEAR", frozen: false };
  }
}

/** Lo que ve quien compra sobre la autenticidad. Nunca acusa ni certifica. */
export type BuyerAuthenticityView = {
  /**
   * `declared`: se muestra lo que declaró el vendedor, como hasta ahora (P4).
   * `unverified`: la declaración «original» se oculta mientras no haya un comprobante revisado.
   * `reviewed`: el equipo revisó un comprobante de compra (no es garantía).
   */
  claim: BuyerAuthenticityClaim;
  /** Etiqueta corta junto al precio; `null` si no hay nada que destacar. */
  label: string | null;
  /** Reemplaza la respuesta de «Autenticidad» cuando `claim` no es `declared`. */
  detail: string | null;
  /** Nota neutral de riesgo medio o alto («Revisa: …»); `null` si no aplica. */
  note: string | null;
};

const PRICE_RULES: readonly RuleId[] = ["price_below_reference", "price_below_comparables"];

export type BuyerCheck = {
  status: AuthenticityStatus;
  riskLevel: RiskLevel;
  signals: readonly { rule: string; weight: number }[];
};

export function buyerAuthenticityView(
  authenticity: Authenticity,
  check: BuyerCheck | null,
): BuyerAuthenticityView {
  if (!check) return { claim: "declared", label: null, detail: null, note: null };

  let claim: BuyerAuthenticityView["claim"] = "declared";
  if (authenticity === "DECLARED_ORIGINAL") {
    if (check.status === "VERIFIED_BY_ADMIN") claim = "reviewed";
    else if (check.status !== "AUTO_CLEAR") claim = "unverified";
  }
  if (claim === "reviewed") {
    return { claim, label: REVIEWED_LABEL, detail: REVIEWED_DETAIL, note: null };
  }

  let note: string | null = null;
  if (check.riskLevel !== "LOW") {
    const price = check.signals.find((signal) => PRICE_RULES.includes(signal.rule as RuleId));
    if (price) {
      note =
        price.weight >= WEIGHTS.priceStrong
          ? "Revisa: el precio es muy inferior al de productos similares."
          : "Revisa: el precio es inferior al de productos similares.";
    } else {
      note = "Revisa bien las fotos y la descripción antes de comprar.";
    }
  }
  return claim === "unverified"
    ? { claim, label: UNVERIFIED_LABEL, detail: UNVERIFIED_DETAIL, note }
    : { claim, label: null, detail: null, note };
}
