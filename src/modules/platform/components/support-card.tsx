import { HeartHandshake } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * «Apoya a speeaking» (ADR-048): mientras el proyecto se formaliza, quien quiera puede apoyarlo con
 * una liga externa de pago. El dinero nunca pasa por la plataforma; aquí solo hay una liga y la
 * página /apoya que explica en qué se usa.
 */
export function SupportCard({ href }: { href: string }) {
  return (
    <section aria-labelledby="apoya" className="flex flex-col gap-2 rounded-3xl border bg-card p-4">
      <h2 id="apoya" className="flex items-center gap-2 font-heading text-base font-bold">
        <HeartHandshake aria-hidden="true" className="size-4 text-primary-text" />
        Apoya a {siteConfig.name}
      </h2>
      <p className="text-sm text-muted-foreground">
        Somos un proyecto independiente hecho en México. Cada peso paga los servidores y la IA que
        te deja probarte ropa gratis.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "outline" }), "h-9 px-3 text-sm font-bold")}
        >
          Apoyar
        </a>
        <Link
          href={"/apoya" as Route}
          className="text-sm font-semibold text-primary-text underline-offset-2 hover:underline"
        >
          En qué se usa
        </Link>
      </div>
    </section>
  );
}
