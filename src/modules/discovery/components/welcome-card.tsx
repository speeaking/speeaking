import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Bienvenida del visitante en la columna derecha (F6, ADR-042): tarjeta blanca con una sola acción
 * principal («Crear cuenta gratis») y enlaces de texto para lo demás. Sin bloque rosa.
 */
export function WelcomeCard() {
  return (
    <section
      aria-labelledby="columna-bienvenida"
      className="rounded-3xl border bg-card p-5 text-foreground"
    >
      <p className="text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase">
        Gratis · una sola cuenta para todo
      </p>
      <h2
        id="columna-bienvenida"
        className="mt-1.5 font-heading text-[26px] leading-none font-extrabold tracking-display"
      >
        Arma tu propio inicio
      </h2>
      <p className="mt-2 text-sm leading-snug text-ink-2">
        Elige tus comunidades y tu inicio se llena de memes, recetas, trucos y cosas que puedes
        comprar sin salir de la conversación.
      </p>
      <Link
        href="/registro"
        className={cn(buttonVariants({ size: "lg" }), "mt-4 h-10 w-full font-bold")}
      >
        Crear cuenta gratis
      </Link>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link
          href="/entrar"
          className="font-bold text-primary-text underline-offset-2 hover:underline"
        >
          Entra
        </Link>
      </p>
      <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
        ¿Vendes algo?{" "}
        <Link
          href={siteConfig.sellerFeaturePath}
          className="font-bold text-primary-text underline-offset-2 hover:underline"
        >
          Hazlo con {siteConfig.sellerFeatureName}
        </Link>
      </p>
    </section>
  );
}
