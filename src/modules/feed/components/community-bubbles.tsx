"use client";

import { ChevronLeft, ChevronRight, Compass, Plus, Users } from "lucide-react";
import { unreadSpokenLabel } from "@/modules/social/unread-labels";
import type { Route } from "next";
import Link from "next/link";
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import { CommunityAvatar } from "@/components/brand/community-avatar";
import { cn } from "@/lib/utils";
import type { HomeCommunityDTO } from "../dto";
import { FOLLOWING, FOR_YOU, type FeedFilter, isSameFilter } from "../feed-filter";

/** Cada burbuja mide 72 px de ancho y ~92 px de alto: de sobra para el dedo (44 px). */
const item = "shrink-0 snap-start";
/** El foco va por dentro (`ring-inset`): la fila tiene scroll y recortaría un anillo exterior. */
const bubble =
  "flex w-[72px] flex-col items-center gap-1.5 rounded-2xl py-1 text-center outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset";
/** Anillo de 62 px: el borde lo pone cada tipo de burbuja. */
const ring = "relative grid size-[62px] place-items-center rounded-full border-[2.5px] p-[2.5px]";
/** Núcleo circular dentro del anillo. */
const core = "grid size-full place-items-center rounded-full";
const label = "max-w-[70px] truncate text-[12.5px] leading-tight font-semibold";

/** «99+»: el número exacto deja de importar y no rompe la burbuja. */
function badgeCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

/**
 * Si la fila tiene más a la izquierda o a la derecha (para mostrar las flechas). Se mide al montar
 * (el ResizeObserver avisa al observar), al cambiar de tamaño y al desplazarse.
 */
function useOverflow(ref: RefObject<HTMLElement | null>, count: number) {
  const [overflow, setOverflow] = useState({ before: false, after: false });
  const measure = () => {
    const list = ref.current;
    if (!list) return;
    const before = list.scrollLeft > 1;
    const after = list.scrollLeft + list.clientWidth < list.scrollWidth - 1;
    setOverflow((current) =>
      current.before === before && current.after === after ? current : { before, after },
    );
  };
  useEffect(() => {
    const list = ref.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(list);
    return () => observer.disconnect();
    // `count`: al cambiar las burbujas cambia el ancho del contenido, no el de la fila.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, count]);
  return { ...overflow, measure };
}

/**
 * Flecha para mouse (escritorio): la fila no tiene barra visible y la rueda no la mueve de lado.
 * Con teclado se llega a cada burbuja con Tab (y la fila se desplaza sola), así que la flecha no
 * entra en el orden de tabulación ni en el árbol accesible; tampoco toma el foco al hacer clic.
 */
function ScrollArrow({ side, onClick }: { side: "before" | "after"; onClick: () => void }) {
  const Icon = side === "before" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden="true"
      data-side={side}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "absolute top-[27px] z-10 hidden size-9 place-items-center rounded-full border bg-card text-foreground shadow-md transition-colors hover:bg-secondary motion-reduce:transition-none md:pointer-fine:grid",
        side === "before" ? "left-1.5" : "right-1.5",
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}

function FilterBubble({
  active,
  onSelect,
  icon,
  ringClass,
  name,
  unread = 0,
  hue,
}: {
  active: boolean;
  onSelect: () => void;
  icon: ReactNode;
  ringClass: string;
  name: string;
  unread?: number;
  hue?: number;
}) {
  return (
    <li className={item}>
      <button
        type="button"
        aria-pressed={active}
        onClick={onSelect}
        // Con novedades, el nombre completo va aquí: Chrome une un texto oculto aparte con un espacio
        // de más («Autos , 1 …»).
        aria-label={unread > 0 ? `${name}, ${unreadSpokenLabel(unread)}` : undefined}
        className={bubble}
        style={hue === undefined ? undefined : ({ "--hue": hue } as CSSProperties)}
      >
        <span aria-hidden="true" className={cn(ring, active ? "border-primary" : ringClass)}>
          {icon}
          {unread > 0 ? (
            <span
              data-slot="unread-badge"
              className="absolute -top-1 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-foreground px-1.5 text-[11px] font-extrabold text-background tabular-nums ring-[2.5px] ring-card"
            >
              {badgeCount(unread)}
            </span>
          ) : null}
        </span>
        <span className={cn(label, active ? "font-extrabold text-foreground" : "text-ink-2")}>
          {name}
        </span>
        {/* Indicador del filtro activo (además de aria-pressed y del peso del texto). */}
        <span
          aria-hidden="true"
          className={cn("h-1 w-5 rounded-full", active ? "bg-primary" : "bg-transparent")}
        />
      </button>
    </li>
  );
}

/**
 * Burbujas del inicio (F5, injerto de «Plaza»): Para ti, Siguiendo, tus comunidades (con el anillo
 * en su color), hasta 4 sugeridas con «+» (abren la comunidad) y Explorar. Las de filtro son
 * botones con `aria-pressed`; las sugeridas y Explorar son enlaces. Visitantes: todas las
 * comunidades filtran y no hay «Siguiendo».
 *
 * `unread` (communityId → publicaciones nuevas) llega de fuera (F7); aquí solo se pinta si es > 0.
 */
export function CommunityBubbles({
  communities,
  suggested = [],
  value,
  onChange,
  isSignedIn,
  unread,
  className,
}: {
  communities: HomeCommunityDTO[];
  suggested?: HomeCommunityDTO[];
  value: FeedFilter;
  onChange: (filter: FeedFilter) => void;
  isSignedIn: boolean;
  unread?: Record<string, number>;
  className?: string;
}) {
  const communityFilter = (community: HomeCommunityDTO): FeedFilter => ({
    kind: "community",
    slug: community.slug,
    name: community.name,
  });
  // Al filtrar por una comunidad, el servidor la marca como vista: el contador se quita aquí también.
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set());
  const listRef = useRef<HTMLUListElement>(null);
  const row = useOverflow(listRef, communities.length + suggested.length);
  const scroll = (direction: -1 | 1) => {
    const list = listRef.current;
    if (!list) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollBy({
      left: direction * list.clientWidth * 0.75,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  return (
    <div
      role="group"
      aria-label="Filtra tu feed"
      className={cn(
        "relative border-b bg-card md:rounded-3xl md:border md:bg-card md:px-2 md:py-2.5",
        className,
      )}
    >
      {row.before ? <ScrollArrow side="before" onClick={() => scroll(-1)} /> : null}
      {row.after ? <ScrollArrow side="after" onClick={() => scroll(1)} /> : null}
      <ul
        ref={listRef}
        onScroll={row.measure}
        className="scrollbar-none flex snap-x snap-mandatory scroll-px-3 gap-1 overflow-x-auto overscroll-x-contain px-3 py-2.5 md:snap-proximity md:scroll-px-1 md:px-1 md:py-0"
      >
        <FilterBubble
          name="Para ti"
          active={isSameFilter(value, FOR_YOU)}
          onSelect={() => onChange(FOR_YOU)}
          ringClass="border-line-strong"
          icon={
            <span className={cn(core, "bg-primary-soft")}>
              <BrandMark className="size-8" />
            </span>
          }
        />
        {isSignedIn ? (
          <FilterBubble
            name="Siguiendo"
            active={isSameFilter(value, FOLLOWING)}
            onSelect={() => onChange(FOLLOWING)}
            ringClass="border-line-strong"
            icon={
              <span className={cn(core, "bg-secondary text-ink-2")}>
                <Users aria-hidden="true" className="size-6" />
              </span>
            }
          />
        ) : null}
        {communities.map((community) => {
          const filter = communityFilter(community);
          return (
            <FilterBubble
              key={community.id}
              name={community.name}
              hue={community.hue}
              active={isSameFilter(value, filter)}
              onSelect={() => {
                setSeen((current) => new Set(current).add(community.id));
                onChange(filter);
              }}
              ringClass="community-border"
              unread={seen.has(community.id) ? 0 : unread?.[community.id]}
              icon={
                <CommunityAvatar
                  name={community.name}
                  emoji={community.emoji}
                  hue={community.hue}
                  decorative
                  className="size-full rounded-full text-[26px]"
                />
              }
            />
          );
        })}
        {suggested.map((community) => (
          <li key={community.id} className={item}>
            <Link
              href={`/c/${community.slug}` as Route}
              // El nombre dice qué pasa al tocar: abre la comunidad para unirte (no filtra).
              aria-label={`${community.name}, comunidad sugerida`}
              className={bubble}
            >
              <span aria-hidden="true" className={cn(ring, "border-border")}>
                <CommunityAvatar
                  name={community.name}
                  emoji={community.emoji}
                  hue={community.hue}
                  decorative
                  className="size-full rounded-full text-[26px]"
                />
                <span className="absolute -right-1 -bottom-1 grid size-[22px] place-items-center rounded-full bg-primary text-primary-foreground ring-[2.5px] ring-card">
                  <Plus className="size-3.5" strokeWidth={3} />
                </span>
              </span>
              <span className={cn(label, "text-muted-foreground")}>{community.name}</span>
              <span aria-hidden="true" className="h-1" />
            </Link>
          </li>
        ))}
        <li className={item}>
          <Link href="/descubrir" className={bubble}>
            <span
              aria-hidden="true"
              className={cn(ring, "border-2 border-dashed border-line-strong p-0.5")}
            >
              <span className={cn(core, "bg-secondary text-muted-foreground")}>
                <Compass className="size-6" />
              </span>
            </span>
            <span className={cn(label, "text-muted-foreground")}>Explorar</span>
            <span aria-hidden="true" className="h-1" />
          </Link>
        </li>
      </ul>
    </div>
  );
}
