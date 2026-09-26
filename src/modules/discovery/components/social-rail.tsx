import { Skeleton } from "@/components/ui/skeleton";
import { repeatsFeedProduct } from "@/modules/feed/dedupe";
import { getHomeFirstPage } from "@/modules/feed/first-page";
import { getSocialRail } from "../service";
import { IntentHighlight } from "./intent-highlight";
import { MovingCommunitiesList } from "./moving-communities-list";
import { OpenDebates } from "./open-debates";

/**
 * Bloques de datos de la columna «Para ti», en orden: Lo que buscas (solo con sesión y una
 * intención activa), Debates abiertos y Comunidades en movimiento.
 *
 * La columna es secundaria y vive en el layout: si su consulta falla, se omite (y se registra) en
 * lugar de tumbar el feed y todas las páginas de la red social.
 */
export async function SocialRailBlocks({ viewerId }: { viewerId: string | null }) {
  const rail = await getSocialRail(viewerId).catch((error: unknown) => {
    console.error("[discovery] no se pudo cargar la columna «Para ti»", error);
    return null;
  });
  if (!rail) return null;
  const signedIn = viewerId !== null;
  // El producto de «Lo que buscas» cuenta dentro del presupuesto comercial: si ya está en la
  // primera página de «Para ti» no se repite aquí. La página se calcula una vez por request
  // (`getHomeFirstPage`): en el inicio es la misma que pinta el feed. La columna vive en el layout y
  // se conserva al navegar, así que la regla se aplica en cualquier página.
  const productInFeed =
    viewerId !== null && rail.intent?.product
      ? await getHomeFirstPage(viewerId)
          .then((page) => repeatsFeedProduct(rail.intent?.product, page.items))
          .catch(() => false)
      : false;
  return (
    <>
      {rail.intent ? <IntentHighlight intent={rail.intent} productInFeed={productInFeed} /> : null}
      <OpenDebates debates={rail.debates} signedIn={signedIn} />
      <MovingCommunitiesList communities={rail.moving} signedIn={signedIn} />
    </>
  );
}

/** Mientras llegan los datos: dos cajas con la misma forma, sin números inventados. */
export function SocialRailSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      {[0, 1].map((box) => (
        <div key={box} className="flex flex-col gap-3 rounded-3xl border bg-card p-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}
