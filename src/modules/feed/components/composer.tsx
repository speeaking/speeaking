import { CircleHelp, ImagePlus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { UserAvatar } from "@/components/brand/user-avatar";
import { cn } from "@/lib/utils";

const CREATE_POST = "/crear/publicacion";

/** Acción rápida: 44 × 44 px en móvil (solo ícono) y con texto en escritorio. */
const quickAction =
  "inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full px-2.5 text-sm font-semibold text-ink-2 transition-colors hover:bg-secondary hover:text-foreground motion-reduce:transition-none md:px-3.5";

/**
 * Compositor del inicio (F5): «¿Qué quieres compartir, Sofía?» como un campo que abre la página de
 * crear publicación, más «Foto» y «Pregunta» con una pista en la URL (`?tipo=`). Sin el botón lima
 * de Sube y vende: su única entrada en escritorio es la columna izquierda.
 */
export function Composer({
  firstName,
  displayName,
  username,
  avatarUrl,
  className,
}: {
  firstName: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  className?: string;
}) {
  return (
    <section
      aria-label="Crear publicación"
      className={cn(
        "flex items-center gap-2 border-b bg-card px-4 py-3 md:gap-3 md:rounded-3xl md:border md:px-4",
        className,
      )}
    >
      <UserAvatar name={displayName} seed={username} src={avatarUrl} className="size-10" />
      <Link
        href={CREATE_POST as Route}
        className="flex h-11 min-w-0 flex-1 items-center rounded-full bg-secondary px-4 text-[15px] text-muted-foreground transition-colors hover:bg-accent motion-reduce:transition-none"
      >
        <span className="truncate">¿Qué quieres compartir, {firstName}?</span>
      </Link>
      <Link href={`${CREATE_POST}?tipo=foto` as Route} aria-label="Foto" className={quickAction}>
        <ImagePlus aria-hidden="true" className="size-5 text-success" />
        <span className="hidden md:inline">Foto</span>
      </Link>
      {/* En teléfonos solo «Foto» (como la maqueta de Plaza): con dos íconos el campo se corta
          antes del nombre («¿Qué quieres compartir, So…»). */}
      <Link
        href={`${CREATE_POST}?tipo=pregunta` as Route}
        aria-label="Pregunta"
        className={cn(quickAction, "max-sm:hidden")}
      >
        <CircleHelp aria-hidden="true" className="size-5 text-primary-text" />
        <span className="hidden md:inline">Pregunta</span>
      </Link>
    </section>
  );
}
