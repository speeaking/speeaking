import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { BrandFaces, BrandMark } from "./brand-mark";

/**
 * Logotipo (ADR-070): «sp», las dos caras en lugar de las «ee» y «aking», en Sora. Las caras bajan
 * un poco de la línea base, como las colas de los globos.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-heading leading-none font-semibold tracking-[-0.02em]",
        className,
      )}
    >
      sp
      <BrandFaces className="mx-[0.02em] h-[0.74em] w-auto translate-y-[0.08em]" />
      aking
    </span>
  );
}

/**
 * El logotipo enlazado al inicio. `collapsible`: en la columna izquierda de escritorio muestra solo
 * el isotipo mientras está plegada (y en tableta) y el logotipo completo cuando está abierta.
 */
export function Logo({
  className,
  collapsible = false,
}: {
  className?: string;
  collapsible?: boolean;
}) {
  return (
    <Link
      href="/"
      className={cn("inline-flex items-center rounded-lg", className)}
      aria-label={`${siteConfig.name}, ir al inicio`}
    >
      {collapsible ? <BrandMark className="size-8 nav-open:hidden" /> : null}
      <Wordmark className={cn("text-[1.375rem]", collapsible && "hidden nav-open:inline-flex")} />
    </Link>
  );
}
