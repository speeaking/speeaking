import { cn } from "@/lib/utils";

/**
 * Marca (ADR-041): la etiqueta de estreno, la que se le quita a algo nuevo antes de usarlo. Una
 * sola figura en el rosa de marca con el ojal en blanco; sin la chispa de la IA. Es la misma figura
 * que `public/brand/mark.svg` (fuente de los íconos de la PWA) y `src/app/icon.svg`.
 */
export function BrandMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("size-8 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path
        d="M27.5 6.5h23a7 7 0 0 1 7 7v23a7 7 0 0 1-2.05 4.95l-22.5 22.5a7 7 0 0 1-9.9 0L7.6 48.5a7 7 0 0 1 0-9.9l14.95-14.95V13.5a7 7 0 0 1 4.95-7z"
        className="fill-primary"
      />
      <circle cx="45" cy="19" r="5.5" className="fill-primary-foreground" />
    </svg>
  );
}
