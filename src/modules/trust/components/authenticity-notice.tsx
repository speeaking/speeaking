import { Info, ShieldCheck, ShieldQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BuyerAuthenticityView } from "../status";

/**
 * Etiqueta de autenticidad y nota de riesgo para quien compra (P14). Neutral: nunca dice «falso»
 * ni certifica nada. «Comprobante revisado» va en verde (estado positivo); lo demás, en gris.
 */
export function AuthenticityNotice({
  view,
  className,
}: {
  view: BuyerAuthenticityView;
  className?: string;
}) {
  if (!view.label && !view.note) return null;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {view.label ? (
        <p
          className={cn(
            "flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
            view.claim === "reviewed"
              ? "bg-success/10 text-success"
              : "bg-secondary text-secondary-foreground",
          )}
        >
          {view.claim === "reviewed" ? (
            <ShieldCheck className="size-4 shrink-0" aria-hidden />
          ) : (
            <ShieldQuestion className="size-4 shrink-0" aria-hidden />
          )}
          {view.label}
        </p>
      ) : null}
      {view.note ? (
        <p className="flex items-start gap-2 rounded-2xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {view.note}
        </p>
      ) : null}
    </div>
  );
}
