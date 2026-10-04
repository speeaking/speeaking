import { CircleHelp, Clapperboard, ImagePlus, UserRound } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { UserAvatar } from "@/components/brand/user-avatar";
import { cn } from "@/lib/utils";

const CREATE_POST = "/crear/publicacion";

/** Acciones discretas; el área táctil conserva 44 px aunque el icono sea pequeño. */
const quickAction =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none";

/**
 * Entrada para compartir al inicio: el campo completo y las acciones llevan a crear la publicación.
 * Sin sesión se pasa por Entrar conservando el destino; con perfil pendiente se abre Bienvenida.
 */
export function Composer({
  firstName,
  displayName,
  username,
  avatarUrl,
  isSignedIn = true,
  needsOnboarding = false,
  className,
}: {
  firstName?: string;
  displayName?: string;
  username?: string;
  avatarUrl: string | null;
  isSignedIn?: boolean;
  needsOnboarding?: boolean;
  className?: string;
}) {
  const destination = (type?: "foto" | "video" | "pregunta") => {
    if (needsOnboarding) return "/bienvenida" as Route;
    const path = `${CREATE_POST}${type ? `?tipo=${type}` : ""}`;
    return (isSignedIn ? path : `/entrar?next=${encodeURIComponent(path)}`) as Route;
  };
  const prompt = firstName
    ? `¿Qué quieres compartir, ${firstName}?`
    : "¿Qué quieres compartir hoy?";

  return (
    <section
      aria-label="Crear publicación"
      className={cn(
        "flex items-center gap-2 border-b bg-card px-3 py-3 md:gap-3 md:rounded-2xl md:border md:px-4",
        className,
      )}
    >
      {displayName && username ? (
        <UserAvatar name={displayName} seed={username} src={avatarUrl} className="size-9" />
      ) : (
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
          <UserRound aria-hidden="true" className="size-4.5" />
        </span>
      )}
      <Link
        href={destination()}
        scroll={false}
        aria-label={prompt}
        className="flex h-11 min-w-0 flex-1 items-center rounded-full bg-secondary/60 px-4 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
      >
        <span className="truncate md:hidden">Comparte algo…</span>
        <span className="hidden truncate md:inline">{prompt}</span>
      </Link>
      <div className="flex shrink-0 items-center">
        <Link
          href={destination("foto")}
          scroll={false}
          aria-label="Foto"
          title="Añadir una foto"
          className={quickAction}
        >
          <ImagePlus aria-hidden="true" className="size-5" />
        </Link>
        <Link
          href={destination("video")}
          scroll={false}
          aria-label="Video"
          title="Añadir un video"
          className={quickAction}
        >
          <Clapperboard aria-hidden="true" className="size-5" />
        </Link>
        <Link
          href={destination("pregunta")}
          scroll={false}
          aria-label="Pregunta"
          title="Hacer una pregunta"
          className={quickAction}
        >
          <CircleHelp aria-hidden="true" className="size-5" />
        </Link>
      </div>
    </section>
  );
}
