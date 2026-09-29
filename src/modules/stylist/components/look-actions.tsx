"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buyLookAction, swapLookItemAction } from "../actions";
import type { OutfitSlot } from "../slots";

/** «Cambiar» una pieza (siguiente opción) o «Más barato». Texto, no botón de color (ADR-042). */
export function SwapButton({
  lookId,
  slot,
  direction = "next",
  children,
}: {
  lookId: string;
  slot: OutfitSlot;
  direction?: "next" | "cheaper";
  children: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="link"
      size="xs"
      disabled={pending}
      focusableWhenDisabled
      className="h-auto px-1 py-1 text-xs"
      onClick={() =>
        startTransition(async () => {
          const result = await swapLookItemAction({ lookId, slot, direction });
          if (!result.ok) toast(result.error);
        })
      }
    >
      {children}
    </Button>
  );
}

/** «Comprar look»: agrega cada pieza disponible al carrito y lleva al carrito. */
export function BuyLookButton({ lookId }: { lookId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      focusableWhenDisabled
      className="h-10 font-bold"
      onClick={() =>
        startTransition(async () => {
          const result = await buyLookAction(lookId);
          if (result && !result.ok) toast.error(result.error);
        })
      }
    >
      Comprar look
    </Button>
  );
}
