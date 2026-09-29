import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Bienvenida del visitante en la columna derecha (F6): el bloque de marca, rosa sólido con texto
 * blanco. Sobre el rosa, el anillo de foco va en blanco y el texto rosa sobre blanco es
 * `text-primary-strong` (ver «Paleta» en docs/design/rediseno-revista.md).
 */
export function WelcomeCard() {
  return (
    <section
      aria-labelledby="columna-bienvenida"
      className="rounded-3xl bg-primary p-5 text-primary-foreground [--ring:oklch(1_0_0)]"
    >
      <p className="text-[11px] font-bold tracking-[0.1em] uppercase">
        Gratis · una sola cuenta para todo
      </p>
      <h2
        id="columna-bienvenida"
        className="mt-1.5 font-heading text-[26px] leading-none font-extrabold tracking-display"
      >
        Arma tu propio inicio
      </h2>
      <p className="mt-2 text-sm leading-snug">
        Elige tus comunidades y tu inicio se llena de memes, recetas, trucos y cosas que puedes
        comprar sin salir de la conversación.
      </p>
      <Link
        href="/registro"
        // `cn` resuelve los conflictos con la variante (fondo, texto, alto y peso).
        className={cn(
          buttonVariants({ size: "lg" }),
          "mt-4 h-10 w-full bg-primary-foreground font-bold text-primary-strong hover:bg-primary-foreground/90 focus-visible:ring-offset-primary",
        )}
      >
        Crear cuenta gratis
      </Link>
      <p className="mt-2 text-center text-xs">
        ¿Ya tienes cuenta?{" "}
        <Link href="/entrar" className="font-bold underline underline-offset-2">
          Entra
        </Link>
      </p>
      <p className="mt-4 border-t border-primary-foreground/30 pt-3 text-xs">
        ¿Vendes algo?{" "}
        <Link
          href={siteConfig.sellerFeaturePath}
          className="font-bold underline underline-offset-2"
        >
          Hazlo con {siteConfig.sellerFeatureName}
        </Link>
      </p>
    </section>
  );
}
