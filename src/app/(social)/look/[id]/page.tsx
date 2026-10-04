import type { Metadata, Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { getViewer } from "@/modules/identity/session";
import { SharedLookActions } from "@/modules/tryon/components/shared-look-actions";
import { getSharedLook } from "@/modules/tryon/shared-look";
import { TRY_ON_DISCLAIMER } from "@/modules/tryon/consent";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = {
  title: "Un look para compartir",
  description: "Mira el look que te compartieron en speeaking.",
  robots: { index: false, follow: false, noimageindex: true },
  referrer: "no-referrer",
  openGraph: {
    title: "Te compartieron un look ❤️",
    description: "Ábrelo en speeaking para verlo y responder.",
    images: [],
  },
  twitter: { card: "summary", title: "Te compartieron un look ❤️", images: [] },
};

export default async function SharedLookPage({ params, searchParams }: PageProps<"/look/[id]">) {
  const [{ id }, query, viewer] = await Promise.all([params, searchParams, getViewer()]);
  const token = typeof query.clave === "string" ? query.clave : undefined;
  const look = await getSharedLook(id, viewer?.userId ?? null, token);
  if (!look)
    return (
      <div className="mx-4 flex flex-col gap-3 rounded-3xl border bg-card p-6 md:mx-0">
        <h1 className="font-heading text-xl font-bold">
          Este look es privado o ya no está disponible
        </h1>
        <p className="text-sm text-muted-foreground">
          Su enlace pudo vencer o desactivarse. Si te lo enviaron por chat, entra con la cuenta que
          lo recibió.
        </p>
        {!viewer ? (
          <Link
            href={
              `/entrar?next=${encodeURIComponent(`/look/${id}${token ? `?clave=${token}` : ""}`)}` as Route
            }
            className="text-sm font-semibold text-primary-text underline"
          >
            Iniciar sesión
          </Link>
        ) : null}
        <Link href="/probar" className="text-sm font-semibold text-primary-text underline">
          Ir a mis pruebas
        </Link>
      </div>
    );
  return (
    <article className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-5 md:px-0">
      <header>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground">UN LOOK PARA TI</p>
        <h1 className="mt-1 font-heading text-2xl font-bold">
          {look.mine ? "Tu look compartido" : `${look.owner.name} quiere tu opinión`}
        </h1>
      </header>
      <figure className="overflow-hidden rounded-3xl border bg-card">
        <Image
          src={look.image.url}
          width={look.image.width}
          height={look.image.height}
          unoptimized
          alt="Simulación de la prenda que te compartieron"
          className="max-h-[65dvh] w-full bg-muted object-contain"
        />
        <figcaption className="p-4">
          <p className="text-lg leading-relaxed font-medium">{look.message}</p>
          <p className="mt-2 text-xs text-muted-foreground">{TRY_ON_DISCLAIMER}</p>
        </figcaption>
      </figure>
      <section aria-label="Prendas de este look" className="rounded-2xl border bg-card p-4">
        <ul className="divide-y">
          {look.products.map((product) => (
            <li key={product.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <Link
                  href={`/producto/${product.slug}` as Route}
                  className="font-semibold hover:underline"
                >
                  {product.title}
                </Link>
                {product.size ? (
                  <p className="text-xs text-muted-foreground">Talla solicitada: {product.size}</p>
                ) : null}
                {!product.available ? (
                  <p className="text-xs text-muted-foreground">Ya no está a la venta</p>
                ) : null}
              </div>
              <span className="shrink-0 font-semibold">
                {formatMoney(product.priceCents, product.currency)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Precio vigente. Confirma con el vendedor que tenga la talla solicitada.
        </p>
      </section>
      {look.approvedBy ? (
        <p className="rounded-2xl bg-secondary p-3 text-sm">
          {look.approvedBy} respondió «Sí, amor ❤️».
        </p>
      ) : null}
      <SharedLookActions
        id={id}
        token={token}
        mine={look.mine}
        canBuy={look.canBuy}
        approved={Boolean(look.approvedBy)}
      />
      <p className="text-center text-xs text-muted-foreground">
        Disponible hasta el{" "}
        {new Intl.DateTimeFormat("es-MX", {
          dateStyle: "medium",
          timeZone: "America/Mexico_City",
        }).format(new Date(look.expiresAt))}
        . Quien lo compartió puede desactivarlo antes.
      </p>
      {look.mine ? (
        <Link
          href="/probar"
          className="text-center text-sm font-semibold text-primary-text underline"
        >
          Mis pruebas y enlaces compartidos
        </Link>
      ) : null}
    </article>
  );
}
