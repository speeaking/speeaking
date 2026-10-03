import { Camera, MessageCircle, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { pageMetadata } from "@/app/seo";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { PUBLIC_FAQ } from "@/config/public-guide";

export const metadata = pageMetadata({
  title: "Cómo funciona: descubre, pruébate y compra",
  description:
    "Conoce speeaking, la plataforma social de compras en México: descubre productos de vendedores, prueba prendas con IA y conversa antes de comprar.",
  path: "/como-funciona",
});

export default function HowItWorksPage() {
  return (
    <>
      <PageHeader
        title="Descubre algo que te guste. Hazlo tuyo."
        description="Comprar empieza con una conversación."
      />
      <div className="flex flex-col gap-6 px-4 pb-8 md:px-0">
        <section className="rounded-3xl border bg-card p-6">
          <h2 className="font-heading text-xl font-bold">¿Qué es speeaking?</h2>
          <p className="mt-3 leading-7 text-muted-foreground">{PUBLIC_FAQ[0].answer}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/comprar" className={buttonVariants()}>
              Explorar productos
            </Link>
            <Link href="/descubrir" className={buttonVariants({ variant: "outline" })}>
              Ver comunidades
            </Link>
          </div>
        </section>
        <section aria-labelledby="comprar-pasos" className="flex flex-col gap-3">
          <h2 id="comprar-pasos" className="font-heading text-xl font-bold">
            De la inspiración a la compra
          </h2>
          {[
            {
              icon: ShoppingBag,
              title: "1. Encuentra tu próximo favorito",
              text: "Explora el catálogo o los productos que comparten las comunidades. En cada ficha puedes revisar el precio, las fotos y la información de la tienda.",
            },
            {
              icon: Camera,
              title: "2. Visualiza una prenda contigo",
              text: "En productos compatibles, usa «Ver cómo me veo» con una foto tuya. Es una simulación con IA: confirma talla, medidas y detalles con el vendedor.",
            },
            {
              icon: MessageCircle,
              title: "3. Conversa y decide",
              text: "Pregunta lo que necesites y revisa disponibilidad, entrega, pagos y devoluciones antes de comprar. Cada tienda publica las condiciones de sus productos.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <article key={title} className="flex gap-4 rounded-2xl border bg-card p-5">
              <Icon aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary-text" />
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{text}</p>
              </div>
            </article>
          ))}
        </section>
        <section className="rounded-3xl border bg-card p-6">
          <h2 className="font-heading text-xl font-bold">¿Tienes una tienda o creas contenido?</h2>
          <p className="mt-3 leading-7 text-muted-foreground">
            Publica tus productos con «Sube y vende» o recomienda productos de tiendas que aceptan
            colaboraciones. Las publicaciones pueden llevar a las personas directamente a la ficha
            del producto.
          </p>
          <nav className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-primary-text">
            <Link href="/studio/sube-y-vende">Empezar a vender</Link>
            <Link href="/creadores">Para creadores</Link>
            <Link href="/precios">Consultar precios</Link>
          </nav>
        </section>
        <Link href="/preguntas-frecuentes" className="text-sm font-semibold text-primary-text">
          Ver todas las preguntas frecuentes →
        </Link>
      </div>
    </>
  );
}
