"use client";

import { ChevronLeft, ChevronRight, Users, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useOptimistic,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/brand/user-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toggleFollowAction } from "@/modules/social/follow-actions";
import { dismissSuggestionAction } from "../actions";
import type { PersonSuggestionDTO } from "../dto";
import { RailSection } from "./rail-section";

export type PeopleSuggestionsVariant = "rail" | "feed";

const TITLE = "Gente de tus comunidades";
/** El carrusel del feed se puede cerrar y no vuelve en la misma sesión del navegador. */
const CLOSED_KEY = "vendeia:gente-de-tus-comunidades:cerrado";

type Kept = ReadonlyMap<string, { person: PersonSuggestionDTO; index: number }>;

/**
 * Seguir revalida la página y el servidor ya no sugiere a quien sigues: sin esto, la tarjeta
 * desaparecería en cuanto tocas «Seguir». Quien seguiste desde aquí se queda en su lugar con
 * «Siguiendo» (y puedes deshacerlo) hasta que cambies de página.
 */
function withKept(people: readonly PersonSuggestionDTO[], kept: Kept) {
  const list = [...people];
  const present = new Set(list.map((person) => person.userId));
  for (const { person, index } of [...kept.values()].sort((a, b) => a.index - b.index)) {
    if (!present.has(person.userId)) list.splice(Math.min(index, list.length), 0, person);
  }
  return list;
}

/**
 * «Gente de tus comunidades»: bloque de la columna derecha (`rail`) o carrusel horizontal dentro
 * del feed (`feed`). Cada persona trae su razón visible, «Seguir» y «Quitar». El carrusel se cierra
 * con la × del encabezado y no vuelve en la sesión; con mouse, tiene flechas para desplazarse.
 */
export function PeopleSuggestionsView({
  people,
  variant,
}: {
  people: PersonSuggestionDTO[];
  variant: PeopleSuggestionsVariant;
}) {
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [kept, setKept] = useState<Kept>(new Map());
  // La lista no crece al seguir a alguien: la persona seguida conserva su lugar.
  const [initialLength] = useState(people.length);
  const closed = useSessionFlag(CLOSED_KEY);
  const visible = withKept(people, kept)
    .slice(0, Math.max(initialLength, people.length))
    .filter((person) => !removed.has(person.userId));
  if (visible.length === 0 || (variant === "feed" && closed.value)) return null;

  const remove = (userId: string) => setRemoved((current) => new Set(current).add(userId));
  const restore = (userId: string) =>
    setRemoved((current) => {
      const next = new Set(current);
      next.delete(userId);
      return next;
    });
  const keep = (person: PersonSuggestionDTO) =>
    setKept((current) => {
      if (current.has(person.userId)) return current;
      const index = visible.findIndex((entry) => entry.userId === person.userId);
      return new Map(current).set(person.userId, { person, index: Math.max(index, 0) });
    });

  const items = visible.map((person) => (
    <SuggestedPerson
      key={person.userId}
      person={person}
      layout={variant === "rail" ? "row" : "card"}
      onFollow={keep}
      onRemove={remove}
      onRestore={restore}
    />
  ));

  if (variant === "rail") {
    return (
      <RailSection id="columna-gente" title={TITLE} icon={Users}>
        <ul className="flex flex-col gap-3">{items}</ul>
      </RailSection>
    );
  }
  return (
    <FeedCarousel count={items.length} onClose={closed.set}>
      {items}
    </FeedCarousel>
  );
}

/** Carrusel del feed: tarjetas con desplazamiento horizontal y, con mouse, flechas. */
function FeedCarousel({
  children,
  count,
  onClose,
}: {
  children: ReactNode;
  count: number;
  onClose: () => void;
}) {
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const edges = useScrollEdges(listRef, count);
  const scroll = (direction: -1 | 1) => {
    const list = listRef.current;
    if (!list) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollBy({
      left: direction * list.clientWidth * 0.8,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };
  // Flechas solo con puntero fino (en táctil se desliza): 28 px, más que los 24 px de WCAG 2.5.8.
  const arrow =
    "hidden text-muted-foreground pointer-fine:inline-flex disabled:pointer-events-none disabled:opacity-40";

  return (
    <RailSection
      id="feed-gente"
      title={TITLE}
      icon={Users}
      bleed
      className="pb-3"
      action={
        <div className="-mr-1.5 flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Ver sugerencias anteriores"
            aria-controls={listId}
            disabled={edges.atStart}
            onClick={() => scroll(-1)}
            className={arrow}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Ver más sugerencias"
            aria-controls={listId}
            disabled={edges.atEnd}
            onClick={() => scroll(1)}
            className={arrow}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            // En móvil el área táctil llega a 44 px sin agrandar el ícono.
            className="relative text-muted-foreground after:absolute after:-inset-2"
            aria-label="Cerrar sugerencias de personas"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
      }
    >
      <ul
        id={listId}
        ref={listRef}
        onScroll={edges.update}
        className="scrollbar-none flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pt-1 pb-1"
      >
        {children}
      </ul>
    </RailSection>
  );
}

function SuggestedPerson({
  person,
  layout,
  onFollow,
  onRemove,
  onRestore,
}: {
  person: PersonSuggestionDTO;
  layout: "row" | "card";
  onFollow: (person: PersonSuggestionDTO) => void;
  onRemove: (userId: string) => void;
  onRestore: (userId: string) => void;
}) {
  const [followed, setFollowed] = useState(false);
  const [following, setOptimisticFollowing] = useOptimistic(followed);
  const [pending, startTransition] = useTransition();
  const profileHref = `/u/${person.username}` as Route;

  const follow = () => {
    const next = !following;
    onFollow(person);
    startTransition(async () => {
      setOptimisticFollowing(next);
      // Estado explícito: un doble toque o una lista vieja no deja de seguir por error.
      const result = await toggleFollowAction(person.userId, next);
      if (result.ok) setFollowed(result.following);
      else toast.error(result.error);
    });
  };

  const dismiss = () => {
    // Fuera de la transición para que desaparezca al instante; si falla, vuelve con un aviso.
    onRemove(person.userId);
    startTransition(async () => {
      const result = await dismissSuggestionAction(person.userId);
      if (!result.ok) {
        onRestore(person.userId);
        toast.error(result.error);
      }
    });
  };

  const name = (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate text-sm font-bold">{person.displayName}</span>
      {person.isStore ? (
        <span className="shrink-0 rounded-full bg-secondary px-1.5 py-px text-[11px] font-bold text-ink-2">
          Tienda
        </span>
      ) : null}
    </span>
  );
  const followButton = (
    <Button
      size="sm"
      variant={following ? "outline" : "soft"}
      // Como FollowButton: el nombre empieza con el texto visible y dice lo que hace el botón.
      aria-label={
        following
          ? `Siguiendo, dejar de seguir a ${person.displayName}`
          : `Seguir a ${person.displayName}`
      }
      disabled={pending}
      // Sigue enfocable mientras espera: con `disabled` nativo el foco de teclado se perdía.
      focusableWhenDisabled
      onClick={follow}
      className={cn(
        "font-bold",
        // En el carrusel el botón se ve de 32 px y su área táctil llega a 44 px.
        layout === "card" &&
          "relative h-8 w-full after:absolute after:inset-x-0 after:-inset-y-1.5",
      )}
    >
      {following ? "Siguiendo" : "Seguir"}
    </Button>
  );
  const dismissButton = (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={`Quitar a ${person.displayName} de tus sugerencias`}
      disabled={pending}
      onClick={dismiss}
      className={cn(
        "text-muted-foreground",
        // En el carrusel el área táctil llega a 44 px: 24 px + 10 px por lado.
        layout === "card" && "absolute top-1.5 right-1.5 after:absolute after:-inset-2.5",
      )}
    >
      <X />
    </Button>
  );

  if (layout === "card") {
    return (
      <li className="relative flex w-40 shrink-0 snap-start flex-col items-center gap-3 rounded-2xl border bg-card p-3 pt-5 text-center">
        <Link
          href={profileHref}
          className="flex w-full flex-col items-center gap-2 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring"
        >
          <UserAvatar
            name={person.displayName}
            seed={person.username}
            src={person.avatarUrl}
            className="size-16 text-lg"
          />
          <span className="flex w-full flex-col items-center gap-0.5">
            {name}
            {/* Tres renglones: «También está en Comida, Gaming y Tecnología» cabe completo. */}
            <span className="line-clamp-3 min-h-12 text-xs leading-4 text-muted-foreground">
              {person.reason}
            </span>
          </span>
        </Link>
        {followButton}
        {/* Después en el DOM (primero se oye quién es) y arriba a la derecha en pantalla. */}
        {dismissButton}
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2.5">
      <Link href={profileHref} className="flex min-w-0 flex-1 items-center gap-2.5">
        <UserAvatar
          name={person.displayName}
          seed={person.username}
          src={person.avatarUrl}
          className="size-10"
        />
        <span className="flex min-w-0 flex-col">
          {name}
          <span className="line-clamp-3 text-xs leading-snug text-muted-foreground">
            {person.reason}
          </span>
        </span>
      </Link>
      {followButton}
      {dismissButton}
    </li>
  );
}

/**
 * Si la lista está al principio o al final (para desactivar las flechas). Se mide al montar, al
 * cambiar de tamaño y al quitar tarjetas; mientras no se mide, ambas flechas quedan desactivadas.
 */
function useScrollEdges(ref: RefObject<HTMLElement | null>, count: number) {
  const [edges, setEdges] = useState({ atStart: true, atEnd: true });
  const update = () => {
    const element = ref.current;
    if (!element) return;
    const atStart = element.scrollLeft <= 1;
    const atEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - 1;
    setEdges((current) =>
      current.atStart === atStart && current.atEnd === atEnd ? current : { atStart, atEnd },
    );
  };
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => update());
    observer.observe(element);
    return () => observer.disconnect();
    // `count`: al quitar una tarjeta cambia el ancho del contenido, no el de la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, count]);
  return { ...edges, update };
}

/** Bandera en sessionStorage (si no está disponible, p. ej. en modo privado, vale solo en esta vista). */
function useSessionFlag(key: string) {
  const [closedHere, setClosedHere] = useState(false);
  const stored = useSyncExternalStore(
    subscribeToStorage,
    () => readSessionFlag(key),
    () => false,
  );
  return {
    value: closedHere || stored,
    set: () => {
      try {
        window.sessionStorage.setItem(key, "1");
      } catch {
        // Sin almacenamiento: se cierra solo en esta vista.
      }
      setClosedHere(true);
    },
  };
}

function subscribeToStorage(listener: () => void) {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

function readSessionFlag(key: string) {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
