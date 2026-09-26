"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateCartItemAction } from "../actions";

export function CartLineControls({
  itemId,
  quantity,
  max,
}: {
  itemId: string;
  quantity: number;
  max: number;
}) {
  const [pending, startTransition] = useTransition();
  const set = (value: number) => startTransition(() => updateCartItemAction(itemId, value));

  return (
    <div className="flex items-center gap-3" aria-busy={pending}>
      <div role="group" aria-label="Cantidad" className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Quitar una pieza"
          disabled={pending || quantity <= 1}
          onClick={() => set(quantity - 1)}
        >
          <Minus />
        </Button>
        <span className="w-7 text-center text-sm font-semibold" aria-live="polite">
          {quantity}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Agregar una pieza"
          disabled={pending || quantity >= max}
          onClick={() => set(quantity + 1)}
        >
          <Plus />
        </Button>
      </div>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Eliminar del carrito"
        disabled={pending}
        onClick={() => set(0)}
      >
        <Trash2 />
        Eliminar
      </Button>
    </div>
  );
}
