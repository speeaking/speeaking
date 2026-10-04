"use client";

import { SendHorizontal } from "lucide-react";
import { useActionState, useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { tapHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { type CommentFormState, createCommentAction } from "../actions";

/**
 * Escribir un comentario. `page`: el formulario de la página de la publicación (campo de dos líneas
 * y botón abajo). `panel`: el del panel de comentarios (ADR-057), en una sola línea que crece con el
 * texto y con el botón de enviar al lado, al alcance del pulgar.
 */
export function CommentForm({
  postId,
  id,
  variant = "page",
}: {
  postId: string;
  id?: string;
  variant?: "page" | "panel";
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();
  const [state, formAction, pending] = useActionState<CommentFormState, FormData>(
    async (previous, formData) => {
      const result = await createCommentAction(previous, formData);
      if (result.ok) {
        formRef.current?.reset();
        tapHaptic();
      }
      return result;
    },
    {},
  );

  // Llegar desde «¿Qué opinas?» (`#comentar`) deja el cursor listo para escribir; también al tocar
  // «Comentar» en la misma página (el ancla nativa dispara `hashchange`).
  useEffect(() => {
    if (!id) return;
    const focusIfTarget = () => {
      if (window.location.hash === `#${id}`) fieldRef.current?.focus();
    };
    focusIfTarget();
    window.addEventListener("hashchange", focusIfTarget);
    return () => window.removeEventListener("hashchange", focusIfTarget);
  }, [id]);

  const panel = variant === "panel";
  return (
    <form ref={formRef} id={id} action={formAction} className="flex scroll-mt-24 flex-col gap-2">
      <input type="hidden" name="postId" value={postId} />
      <label htmlFor={fieldId} className="sr-only">
        Escribe un comentario
      </label>
      <div className={cn(panel && "flex items-end gap-2")}>
        <Textarea
          ref={fieldRef}
          id={fieldId}
          name="body"
          rows={panel ? 1 : 2}
          maxLength={500}
          placeholder="Escribe un comentario o menciona a @usuario…"
          className={cn(
            "text-base",
            panel && "[field-sizing:content] max-h-32 min-h-11 flex-1 resize-none rounded-3xl",
          )}
          required
        />
        {panel ? (
          <Button
            type="submit"
            size="icon-lg"
            aria-label="Comentar"
            disabled={pending}
            className="size-11 shrink-0 rounded-full"
          >
            <SendHorizontal />
          </Button>
        ) : null}
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {panel ? null : (
        <Button type="submit" className="self-end" disabled={pending}>
          {pending ? "Publicando…" : "Comentar"}
        </Button>
      )}
    </form>
  );
}
