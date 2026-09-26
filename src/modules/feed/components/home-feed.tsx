"use client";

import { Compass, RefreshCw, Users } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { type ReactNode, useRef, useState } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { FeedSkeleton } from "@/components/states/feed-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import type { FeedPageDTO, HomeBubblesDTO } from "../dto";
import {
  FOR_YOU,
  type FeedFilter,
  filterAnnouncement,
  filterKey,
  filterParams,
  isSameFilter,
} from "../feed-filter";
import { CommunityBubbles } from "./community-bubbles";
import { type FeedSlot, FeedList } from "./feed-list";

type Status = "idle" | "loading" | "error";

/** Estado vacío de un filtro: dice qué verá aquí y ofrece el siguiente paso (sin inventar nada). */
function FilterEmpty({ filter }: { filter: FeedFilter }) {
  return (
    <div className="px-4 pt-4 md:p-0">
      <FilterEmptyState filter={filter} />
    </div>
  );
}

function FilterEmptyState({ filter }: { filter: FeedFilter }) {
  if (filter.kind === "following") {
    return (
      <EmptyState
        icon={Users}
        title="Aquí verás a quienes sigues"
        description="Todavía no hay publicaciones recientes de personas que sigues. Encuéntralas en tus comunidades."
        action={
          <Link href="/descubrir" className={buttonVariants({ variant: "soft" })}>
            Explorar comunidades
          </Link>
        }
      />
    );
  }
  if (filter.kind === "community") {
    return (
      <EmptyState
        icon={Compass}
        title={`Aún no hay publicaciones recientes en ${filter.name}`}
        description="Sé la primera persona en compartir algo con esta comunidad."
        action={
          <Link href={`/c/${filter.slug}` as Route} className={buttonVariants({ variant: "soft" })}>
            Ir a {filter.name}
          </Link>
        }
      />
    );
  }
  return null;
}

/**
 * Inicio: burbujas (F5) + feed. Tocar una burbuja filtra el feed con `/api/feed` (`community` o
 * `following`) sin salir de la página; «Para ti» vuelve a la primera página que pintó el servidor.
 * Los bloques intercalados (`slots`) y lo que va antes del feed solo acompañan a «Para ti».
 */
export function HomeFeed({
  header,
  bubbles,
  unread,
  isSignedIn,
  initialPage,
  beforeFeed,
  empty,
  slots,
}: {
  /** Encabezado «Para ti»: en móvil las burbujas van arriba de él (como la maqueta). */
  header: ReactNode;
  bubbles: HomeBubblesDTO;
  /** communityId → publicaciones nuevas (F7). */
  unread?: Record<string, number>;
  isSignedIn: boolean;
  initialPage: FeedPageDTO;
  /** Compositor, bienvenida… (solo en «Para ti»). */
  beforeFeed?: ReactNode;
  empty: ReactNode;
  slots?: readonly FeedSlot[];
}) {
  const [filter, setFilter] = useState<FeedFilter>(FOR_YOU);
  const [pages, setPages] = useState<ReadonlyMap<string, FeedPageDTO>>(new Map());
  const [status, setStatus] = useState<Status>("idle");
  // Lo que se anuncia al cambiar de filtro (vacío al cargar la página: no hubo cambio).
  const [announcement, setAnnouncement] = useState("");
  // El último filtro pedido: si llega tarde la respuesta de uno anterior, no cambia el estado.
  const requested = useRef(filterKey(FOR_YOU));

  // El servidor vuelve a pintar el inicio al seguir a alguien o unirse a una comunidad (se revalida el
  // layout): las páginas guardadas de otros filtros pueden estar viejas («Siguiendo» seguiría vacío
  // después de seguir a alguien). Se olvidan y se piden de nuevo al tocarlas; la del filtro abierto
  // se conserva para no mover lo que la persona está leyendo.
  const [served, setServed] = useState(initialPage);
  if (served !== initialPage) {
    setServed(initialPage);
    const openKey = filterKey(filter);
    const open = pages.get(openKey);
    setPages(open ? new Map([[openKey, open]]) : new Map());
  }

  const load = async (next: FeedFilter) => {
    const key = filterKey(next);
    requested.current = key;
    setStatus("loading");
    try {
      const response = await fetch(`/api/feed?${filterParams(next)}`);
      if (!response.ok) throw new Error(String(response.status));
      const page = (await response.json()) as FeedPageDTO;
      setPages((current) => new Map(current).set(key, page));
      if (requested.current === key) setStatus("idle");
    } catch {
      if (requested.current === key) setStatus("error");
    }
  };

  const select = (next: FeedFilter) => {
    if (isSameFilter(next, filter) && status !== "error") return;
    setFilter(next);
    setAnnouncement(filterAnnouncement(next));
    if (next.kind === "for-you" || pages.has(filterKey(next))) {
      requested.current = filterKey(next);
      setStatus("idle");
      return;
    }
    void load(next);
  };

  const key = filterKey(filter);
  const forYou = filter.kind === "for-you";
  const page = forYou ? initialPage : pages.get(key);

  return (
    <div className="flex flex-col md:gap-4">
      <div className="flex flex-col">
        {header}
        <CommunityBubbles
          className="max-md:order-first"
          communities={bubbles.filters}
          suggested={bubbles.suggested}
          value={filter}
          onChange={select}
          isSignedIn={isSignedIn}
          unread={unread}
        />
      </div>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {forYou ? beforeFeed : null}

      <div>
        {status === "loading" && !page ? (
          <div className="pt-4 md:pt-0">
            <FeedSkeleton count={2} />
          </div>
        ) : status === "error" && !page ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center text-sm text-muted-foreground">
            <p>No pudimos cargar estas publicaciones.</p>
            <Button variant="outline" onClick={() => void load(filter)}>
              <RefreshCw data-icon="inline-start" />
              Reintentar
            </Button>
          </div>
        ) : page ? (
          <FeedList
            key={key}
            initialPage={page}
            community={filter.kind === "community" ? filter.slug : undefined}
            following={filter.kind === "following"}
            isSignedIn={isSignedIn}
            empty={forYou ? empty : <FilterEmpty filter={filter} />}
            slots={forYou ? slots : undefined}
          />
        ) : null}
      </div>
    </div>
  );
}
