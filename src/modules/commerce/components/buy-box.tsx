"use client";

import { Minus, Plus, ShoppingBag } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addToCartAction, buyNowAction, type CartActionResult, cartSheetAction } from "../actions";
import type { CartSheetDTO } from "../cart-sheet";
import { CartSheet } from "./cart-sheet";

export function BuyBox({
  productId,
  maxQuantity,
  inStock,
  unavailableLabel = "Agotado",
  sourcePostId,
}: {
  productId: string;
  maxQuantity: number;
  inStock: boolean;
  /** Texto del botón cuando no se puede comprar (agotado o pausado por el vendedor). */
  unavailableLabel?: string;
  sourcePostId: string | null;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [pending, startTransition] = useTransition();
  // El carrito como panel (ADR-052): se abre al instante y se llena cuando llega.
  const [sheet, setSheet] = useState<{ open: boolean; cart: CartSheetDTO | null }>({
    open: false,
    cart: null,
  });

  const handle = (result: CartActionResult) => {
    if (result.ok) return true;
    if (result.needsAuth) {
      router.push(`/entrar?next=${encodeURIComponent(window.location.pathname)}` as Route);
    } else {
      toast.error(result.error);
    }
    return false;
  };

  if (!inStock) {
    return (
      <Button size="lg" className="h-12 text-base" disabled>
        {unavailableLabel}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Cantidad</span>
        <div className="flex items-center rounded-full border">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Quitar una pieza"
            disabled={quantity <= 1}
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
          >
            <Minus />
          </Button>
          <span className="w-8 text-center font-semibold" aria-live="polite">
            {quantity}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Agregar una pieza"
            disabled={quantity >= maxQuantity}
            onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
          >
            <Plus />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="lg"
          className="h-12 text-base"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              handle(await buyNowAction({ productId, quantity, sourcePostId }));
            })
          }
        >
          Comprar ahora
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-12 text-base"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await addToCartAction({ productId, quantity, sourcePostId });
              if (handle(result)) {
                setSheet({ open: true, cart: null });
                setSheet({ open: true, cart: await cartSheetAction() });
                // El contador del carrito de arriba es del servidor: se repinta sin perder el panel.
                router.refresh();
              }
            })
          }
        >
          <ShoppingBag data-icon="inline-start" />
          Al carrito
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Etapa de prueba: los pagos son simulados, no se cobra nada.
      </p>
      <CartSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
        cart={sheet.cart}
      />
    </div>
  );
}
