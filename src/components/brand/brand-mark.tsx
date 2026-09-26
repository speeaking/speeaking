import { cn } from "@/lib/utils";

/**
 * Marca: burbuja de conversación (lo social) con una "v" de aprobación y una chispa (la IA).
 * Es la misma figura que `public/brand/mark.svg` (fuente de los íconos de la PWA).
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
        d="M20 8h18a14 14 0 0 1 14 14v12a14 14 0 0 1-14 14H25l-11 8 2.5-9.2A14 14 0 0 1 6 34V22A14 14 0 0 1 20 8z"
        className="fill-primary"
      />
      <path
        d="M19 24.5l9.5 11.5 9.5-11.5"
        fill="none"
        strokeWidth={5.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary-foreground"
      />
      <path
        d="M54 1.5c1.1 5.6 2.4 6.9 8 8-5.6 1.1-6.9 2.4-8 8-1.1-5.6-2.4-6.9-8-8 5.6-1.1 6.9-2.4 8-8z"
        strokeWidth={3}
        strokeLinejoin="round"
        className="fill-ai stroke-background"
      />
    </svg>
  );
}
