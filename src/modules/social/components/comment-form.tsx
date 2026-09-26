"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { type CommentFormState, createCommentAction } from "../actions";

export function CommentForm({ postId, id }: { postId: string; id?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const [state, formAction, pending] = useActionState<CommentFormState, FormData>(
    async (previous, formData) => {
      const result = await createCommentAction(previous, formData);
      if (result.ok) formRef.current?.reset();
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

  return (
    <form ref={formRef} id={id} action={formAction} className="flex scroll-mt-24 flex-col gap-2">
      <input type="hidden" name="postId" value={postId} />
      <label htmlFor="comentario" className="sr-only">
        Escribe un comentario
      </label>
      <Textarea
        ref={fieldRef}
        id="comentario"
        name="body"
        rows={2}
        maxLength={500}
        placeholder="Escribe un comentario amable…"
        className="text-base"
        required
      />
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="self-end" disabled={pending}>
        {pending ? "Publicando…" : "Comentar"}
      </Button>
    </form>
  );
}
