import Link from "next/link";
import { pageMetadata } from "@/app/seo";
import { PageHeader } from "@/components/layout/page-header";
import { JsonLd } from "@/components/seo/json-ld";
import { PUBLIC_FAQ } from "@/config/public-guide";

export const metadata = pageMetadata({
  title: "Preguntas frecuentes: compras, ventas y prueba virtual",
  description:
    "Resuelve tus dudas sobre speeaking: cómo comprar, vender, probarte prendas con IA, colaborar con tiendas y recuperar tu cuenta.",
  path: "/preguntas-frecuentes",
});

export default function FAQPage() {
  return (
    <>
      <PageHeader
        title="Preguntas frecuentes"
        description="Lo que necesitas saber para empezar en speeaking."
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: PUBLIC_FAQ.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }}
      />
      <div className="flex flex-col gap-3 px-4 pb-8 md:px-0">
        {PUBLIC_FAQ.map((item) => (
          <details
            key={item.question}
            className="group rounded-2xl border bg-card p-5 open:border-primary/30"
          >
            <summary className="cursor-pointer font-semibold marker:text-primary">
              {item.question}
            </summary>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.answer}</p>
          </details>
        ))}
        <nav
          aria-label="Más información"
          className="flex flex-wrap gap-4 p-2 text-sm font-semibold text-primary-text"
        >
          <Link href="/como-funciona">Cómo funciona</Link>
          <Link href="/precios">Precios</Link>
          <Link href="/seguridad">Seguridad</Link>
          <Link href="/recuperar-contrasena">Recuperar contraseña</Link>
        </nav>
      </div>
    </>
  );
}
