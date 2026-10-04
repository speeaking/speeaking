"use client";

import { ChevronUp, ScrollText } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { SIMULATED_OUTPUT_LABEL } from "@/modules/ai/tasks/simulation";
import { getPostContextAction } from "../context-actions";
import type { PostContextResult } from "../post-context-service";

const FAILED = "No pudimos resumirla en este momento. Intenta más tarde.";

/**
 * «Contexto» (ADR-060): en una publicación larga, un resumen corto y neutral sin salir de la
 * tarjeta. Se pide al tocarlo (no antes: así no se gasta en lo que nadie abre), se guarda para
 * todos y dice con honestidad que lo redactó la IA a partir de la publicación.
 */
export function ContextButton({ postId }: { postId: string }) {
  const panelId = useId();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<PostContextResult | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (result?.ok || pending) return;
    startTransition(async () => {
      try {
        setResult(await getPostContextAction(postId));
      } catch {
        setResult({ ok: false, reason: "failed" });
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex h-9 items-center gap-1.5 self-start rounded-full bg-secondary px-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent motion-reduce:transition-none"
      >
        {open ? (
          <ChevronUp aria-hidden="true" className="size-4" />
        ) : (
          <ScrollText aria-hidden="true" className="size-4" />
        )}
        Contexto
      </button>
      {open ? (
        <section
          id={panelId}
          aria-label="Contexto"
          aria-busy={pending}
          className="flex flex-col gap-1.5 rounded-2xl border bg-background p-3.5 motion-safe:animate-in motion-safe:duration-200 motion-safe:fade-in motion-safe:slide-in-from-top-1"
        >
          {pending || !result ? (
            <div className="flex flex-col gap-2" aria-label="Leyendo la publicación completa…">
              <p className="text-xs text-muted-foreground">
                Preparando el contexto del texto completo…
              </p>
              <span className="h-3.5 w-11/12 animate-pulse rounded bg-muted" />
              <span className="h-3.5 w-4/5 animate-pulse rounded bg-muted" />
              <span className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
            </div>
          ) : result.ok ? (
            <>
              <p className="text-[15px] leading-relaxed">{result.summary}</p>
              <p className="text-xs text-muted-foreground">
                {result.simulated
                  ? SIMULATED_OUTPUT_LABEL
                  : "Resumen hecho con IA a partir de esta publicación. Puede omitir matices: si te interesa, léela completa."}
              </p>
            </>
          ) : result.reason === "needs_auth" ? (
            <p className="text-sm text-muted-foreground">
              <Link
                href={`/registro?next=${encodeURIComponent(pathname || "/")}` as Route}
                className="font-semibold text-foreground underline"
              >
                Crea tu cuenta gratis
              </Link>{" "}
              para ver el contexto de esta publicación.
            </p>
          ) : (
            <p role="status" className="text-sm text-muted-foreground">
              {result.reason === "limited" && result.message ? result.message : FAILED}
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
