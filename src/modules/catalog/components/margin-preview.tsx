import { Calculator, TriangleAlert } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { parsePesosToCents, unitEconomics } from "../pricing";

/** Vista previa del margen calculada por código (P2), con las mismas funciones del servidor. */
export function MarginPreview({ price, cost }: { price: string; cost: string }) {
  const priceCents = parsePesosToCents(price);
  const costCents = parsePesosToCents(cost);
  if (!priceCents || costCents === null) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">
        <Calculator className="size-4" />
        Escribe precio y costo para ver cuánto ganas por pieza.
      </p>
    );
  }
  const economics = unitEconomics({ priceCents, unitCostCents: costCents });
  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-2xl px-3 py-2.5 text-sm",
        economics.isLoss ? "bg-destructive/10 text-destructive" : "bg-success/10 text-foreground",
      )}
    >
      {economics.isLoss ? (
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      ) : (
        <Calculator className="mt-0.5 size-4 shrink-0" />
      )}
      <span>
        {economics.isLoss ? "Pierdes " : "Ganas "}
        <strong>{formatMoney(Math.abs(economics.grossMarginCents))}</strong> por pieza (
        {economics.grossMarginPercent.toFixed(1)} % del precio), antes de envío, comisiones y
        publicidad. <span className="text-ink-2">Cálculo exacto, no estimación de IA.</span>
      </span>
    </p>
  );
}
