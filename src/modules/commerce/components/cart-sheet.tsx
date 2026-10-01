"use client";

import { ShoppingBag } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CartSheetDTO } from "../cart-sheet";

const DESKTOP = "(min-width: 768px)";
const subscribe = (onChange: () => void) => {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(DESKTOP);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const isDesktop = () =>
  typeof window.matchMedia === "function" && window.matchMedia(DESKTOP).matches;

/**
 * El carrito como panel (ADR-052): al agregar algo no te saca de donde estabas. En teléfono sube
 * desde abajo; en escritorio entra por la derecha. Muestra las piezas, el subtotal y dos salidas:
 * pagar o seguir viendo. El carrito completo (cantidades, envío) sigue en /carrito.
 */
export function CartSheet({
  open,
  onOpenChange,
  cart,
  title = "Agregado al carrito",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` mientras llega. */
  cart: CartSheetDTO | null;
  title?: string;
}) {
  const desktop = useSyncExternalStore(subscribe, isDesktop, () => false);
  const pieces = cart ? (cart.count === 1 ? "1 pieza" : `${cart.count} piezas`) : null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={desktop ? "right" : "bottom"}
        className={cn("max-h-dvh", !desktop && "max-h-[85dvh] rounded-t-3xl")}
      >
        <SheetHeader className="pr-12">
          <SheetTitle className="flex items-center gap-2 text-lg font-bold">
            <ShoppingBag aria-hidden="true" className="size-5 text-primary-text" />
            {title}
          </SheetTitle>
          <SheetDescription>
            {cart ? `${pieces} · ${formatMoney(cart.subtotalCents, cart.currency)}` : "Un momento…"}
          </SheetDescription>
        </SheetHeader>
        <ul
          className="flex min-h-0 flex-col gap-3 overflow-y-auto px-4"
          aria-label="Piezas en tu carrito"
        >
          {cart?.lines.map((line) => (
            <li key={line.itemId} className="flex items-center gap-3">
              <Link
                href={`/producto/${line.slug}` as Route}
                className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted"
                aria-hidden="true"
                tabIndex={-1}
              >
                {line.imageUrl ? (
                  <Image src={line.imageUrl} alt="" fill sizes="64px" className="object-cover" />
                ) : null}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <Link
                  href={`/producto/${line.slug}` as Route}
                  className="line-clamp-2 text-sm font-medium"
                >
                  {line.title}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {line.quantity} × {formatMoney(line.priceCents, line.currency)}
                </span>
                {!line.available ? (
                  <span className="text-xs font-semibold text-destructive">Ya no disponible</span>
                ) : null}
              </div>
              <span className="font-heading font-bold tabular-nums">
                {formatMoney(line.priceCents * line.quantity, line.currency)}
              </span>
            </li>
          ))}
        </ul>
        <SheetFooter>
          <Link href={"/checkout" as Route} className={cn(buttonVariants(), "h-11 font-bold")}>
            Ir a pagar
          </Link>
          <SheetClose
            render={
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline" }), "h-11")}
              />
            }
          >
            Seguir viendo
          </SheetClose>
          <Link
            href={"/carrito" as Route}
            className="py-1 text-center text-sm font-semibold text-primary-text underline-offset-2 hover:underline"
          >
            Ver el carrito completo
          </Link>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
