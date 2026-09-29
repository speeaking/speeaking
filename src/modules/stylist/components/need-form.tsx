import { Sparkles } from "lucide-react";
import type { Route } from "next";
import Form from "next/form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { NEED_TEXT_MAX } from "../need";

export const NEED_EXAMPLES = [
  "El viernes tengo una boda de noche y quiero algo moderno por menos de $3,000",
  "Necesito ropa para una entrevista de trabajo",
  "Algo casual para salir, tengo $1,500",
  "Voy a la playa y quiero verme bien sin gastar mucho",
] as const;

export function needHref(text: string) {
  return `/estilista?necesidad=${encodeURIComponent(text)}` as Route;
}

/**
 * «¿Qué necesitas?» (ADR-043): un campo y un botón. Envía por GET a /estilista para que el
 * resultado se pueda compartir y volver a abrir. `compact` es la versión del inicio.
 */
export function NeedForm({
  defaultValue = "",
  compact = false,
  className,
}: {
  defaultValue?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Form action="/estilista" className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor="necesidad" className="sr-only">
          ¿Qué necesitas?
        </label>
        <Input
          id="necesidad"
          name="necesidad"
          defaultValue={defaultValue}
          maxLength={NEED_TEXT_MAX}
          required
          minLength={3}
          placeholder="Ej. Tengo una boda el viernes y no sé qué ponerme"
          className="h-11 flex-1 text-base"
          autoComplete="off"
        />
        <Button type="submit" size="lg" className="h-11 shrink-0 px-4 font-bold">
          <Sparkles data-icon="inline-start" />
          Crea mi look
        </Button>
      </Form>
      {compact ? null : (
        <ul className="flex flex-wrap gap-2" aria-label="Ejemplos">
          {NEED_EXAMPLES.map((example) => (
            <li key={example}>
              <Link
                href={needHref(example)}
                className="inline-flex max-w-full items-center rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-secondary"
              >
                <span className="truncate">{example}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
