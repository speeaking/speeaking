import type { ReactNode } from "react";
import type { DecisionStatus, ExperimentStatus, RiskLevel } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const PILL =
  "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold whitespace-nowrap";

const RISK_CLASSES: Record<RiskLevel, string> = {
  LOW: "bg-secondary text-secondary-foreground",
  MEDIUM: "border border-line-strong text-foreground",
  HIGH: "bg-destructive/10 text-destructive",
};

export function RiskBadge({ risk, label }: { risk: RiskLevel; label: string }) {
  return <span className={cn(PILL, RISK_CLASSES[risk])}>{label}</span>;
}

const STATUS_CLASSES: Record<DecisionStatus | ExperimentStatus, string> = {
  PROPOSED: "bg-secondary text-ink-2",
  APPROVED: "bg-secondary text-secondary-foreground",
  APPLIED: "bg-success/10 text-success",
  REVERTED: "bg-destructive/10 text-destructive",
  REJECTED: "bg-muted text-muted-foreground",
  DRAFT: "bg-muted text-muted-foreground",
  RUNNING: "bg-secondary text-ink-2",
  STOPPED: "bg-destructive/10 text-destructive",
  CONCLUDED: "bg-success/10 text-success",
};

export function StatusBadge({
  status,
  label,
}: {
  status: DecisionStatus | ExperimentStatus;
  label: string;
}) {
  return <span className={cn(PILL, STATUS_CLASSES[status])}>{label}</span>;
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn(PILL, "bg-muted text-muted-foreground", className)}>{children}</span>;
}
