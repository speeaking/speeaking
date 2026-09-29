import { MessageCircle } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * «Mensaje»: abre la conversación con una persona (ADR-047). Sin sesión lleva a crear cuenta y
 * vuelve a abrirla. `text` prellena el primer mensaje (p. ej. desde la ficha de un producto).
 */
export function MessageButton({
  username,
  isSignedIn,
  text,
  label = "Mensaje",
  variant = "outline",
  className,
}: {
  username: string;
  isSignedIn: boolean;
  text?: string;
  label?: string;
  variant?: "outline" | "soft" | "ghost";
  className?: string;
}) {
  const target = `/mensajes/nuevo?${new URLSearchParams({ para: username, ...(text ? { texto: text } : {}) })}`;
  const href = (isSignedIn ? target : `/registro?next=${encodeURIComponent(target)}`) as Route;
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant }),
        "h-11 px-4 text-[15px] font-bold md:h-10",
        className,
      )}
    >
      <MessageCircle data-icon="inline-start" />
      {label}
    </Link>
  );
}
