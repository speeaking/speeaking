import { HeartHandshake } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { env } from "@/server/env";

export const metadata: Metadata = {
  title: "Apoya el proyecto",
  description:
    "Estreno es un proyecto independiente hecho en México. Qué cuesta mantenerlo, de dónde sale el dinero y en qué se usa.",
};

/**
 * /apoya (ADR-048): transparencia. Mientras el proyecto se formaliza, cualquiera puede apoyarlo con
 * una liga externa; después el sostén son las tiendas (ADR-046). Cifras: docs/modelo-de-ingresos.md.
 */
export default function SupportPage() {
  const costs = [
    { label: "Servidores, base de datos y fotos", value: "≈ $700 MXN al mes" },
    { label: "Cada prueba de «Ver cómo me veo»", value: "≈ $1.26 MXN" },
    { label: "Textos de la IA para tiendas (propuestas, kits, looks)", value: "≈ $900 MXN al mes" },
    {
      label: "Desarrollo con IA (la persona y la IA que construyen esto)",
      value: "desde $360 MXN al mes",
    },
  ];
  const uses = [
    "Primero, que la plataforma siga encendida: servidores, base de datos y fotos.",
    "Después, las pruebas de cortesía: cada tienda nueva estrena con 10 pruebas que paga Estreno.",
    "Lo que sobre, en desarrollo: mensajes, avisos, búsqueda por foto y mejor IA.",
  ];
  return (
    <>
      <PageHeader
        title={`Apoya a ${siteConfig.name}`}
        description="Somos un proyecto independiente hecho en México, sin inversionistas ni empresa detrás todavía. Aquí está, sin adornos, qué cuesta, de dónde sale el dinero y en qué se usa."
      />
      <div className="flex flex-col gap-4 px-4 md:px-0">
        <section className="flex flex-col gap-3 rounded-3xl border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">Qué cuesta mantenerlo [estimación]</h2>
          <dl className="grid gap-2 sm:grid-cols-2">
            {costs.map((cost) => (
              <div key={cost.label} className="flex flex-col rounded-2xl bg-secondary px-3 py-2">
                <dt className="text-xs text-muted-foreground">{cost.label}</dt>
                <dd className="font-semibold">{cost.value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            Cifras de referencia del piloto, con precios de lista de los proveedores; el detalle y
            las fuentes están en el documento público del modelo de ingresos del proyecto.
          </p>
        </section>

        <section className="flex flex-col gap-2 rounded-3xl border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">De dónde sale el dinero</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
            <li>
              De las tiendas: pagan cada prueba de «Ver cómo me veo» sobre sus productos y los días
              de producto destacado. Quien compra no paga nunca por usar {siteConfig.name}.
            </li>
            <li>
              De apoyos voluntarios, mientras el proyecto se formaliza. Un apoyo no compra nada ni
              da ventajas: es eso, un apoyo.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2 rounded-3xl border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">En qué se usa, en este orden</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2">
            {uses.map((use) => (
              <li key={use}>{use}</li>
            ))}
          </ol>
        </section>

        <section className="flex flex-col gap-3 rounded-3xl border bg-card p-5">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
            <HeartHandshake aria-hidden="true" className="size-5 text-primary-text" />
            Apoyar
          </h2>
          {env.SUPPORT_URL ? (
            <>
              <p className="text-sm text-ink-2">
                El apoyo se hace en una liga externa de pago: {siteConfig.name} nunca ve ni guarda
                datos de tu tarjeta.
              </p>
              <a
                href={env.SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants(), "h-11 w-fit px-5 font-bold")}
              >
                Apoyar a {siteConfig.name}
              </a>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Todavía no hay una liga de apoyo activa. Mientras tanto, la mejor ayuda es usar la
              plataforma, invitar a alguien que venda y decirnos qué mejorar.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Cómo cuidamos tus datos:{" "}
            <Link href={"/seguridad" as Route} className="underline">
              seguridad y privacidad
            </Link>
            .
          </p>
        </section>
      </div>
    </>
  );
}
