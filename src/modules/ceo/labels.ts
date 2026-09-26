import type { DecisionStatus, ExperimentStatus, RiskLevel } from "@/generated/prisma/enums";
import { siteConfig } from "@/config/site";
import type { TrailAction } from "./decision-record";

/** Textos de interfaz del motor de automejora (es-MX). */

export const STATUS_LABELS: Record<DecisionStatus, string> = {
  PROPOSED: "Propuesta",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  APPLIED: "Aplicada",
  REVERTED: "Revertida",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  LOW: "Riesgo bajo",
  MEDIUM: "Riesgo medio",
  HIGH: "Riesgo alto",
};

export const EXPERIMENT_STATUS_LABELS: Record<ExperimentStatus, string> = {
  DRAFT: "Borrador",
  RUNNING: "En curso",
  STOPPED: "Detenido",
  CONCLUDED: "Concluido",
};

export const TRAIL_ACTION_LABELS: Record<TrailAction, string> = {
  proposed: "Propuesta",
  held: "En espera",
  approved: "Aprobada",
  rejected: "Rechazada",
  applied: "Aplicada",
  auto_applied: "Aplicada sola",
  reverted: "Revertida",
  auto_reverted: "Revertida sola",
  experiment_started: "Experimento iniciado",
  experiment_stopped: "Experimento detenido",
  experiment_concluded: "Experimento concluido",
  monitor_closed: "Vigilancia cerrada",
};

export const ACTOR_LABELS = { AI: "IA", HUMAN: "Equipo", SYSTEM: "Sistema" } as const;

const dateTime = new Intl.DateTimeFormat(siteConfig.locale, {
  timeZone: siteConfig.timeZone,
  dateStyle: "medium",
  timeStyle: "short",
});

const dateOnly = new Intl.DateTimeFormat(siteConfig.locale, {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
});

/** Fecha y hora en la Ciudad de México ("26 sept 2026, 10:30"). */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return dateTime.format(typeof value === "string" ? new Date(value) : value);
}

/** Un `Day` ("2026-09-26") como fecha corta ("26 sept"). */
export function formatDay(day: string): string {
  return dateOnly.format(new Date(`${day}T00:00:00Z`));
}
