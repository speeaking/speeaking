"use client";

import { SendHorizontal } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { type MessageFormState, sendMessageAction } from "../actions";
import { MAX_MESSAGE_LENGTH } from "../pair";

/**
 * Campo para escribir en un hilo (ADR-047). Enter envía; Shift+Enter hace salto de línea. Al
 * enviarse, el campo se vacía y el hilo se vuelve a pintar desde el servidor.
 */
export function MessageForm({
  conversationId,
  initialText = "",
}: {
  conversationId: string;
  initialText?: string;
}) {
  const [state, formAction, pending] = useActionState<MessageFormState, FormData>(
    sendMessageAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state.sentId && textRef.current) {
      textRef.current.value = "";
      textRef.current.focus();
    }
  }, [state.sentId]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="conversationId" value={conversationId} />
      <div className="flex items-end gap-2">
        <label htmlFor="mensaje" className="sr-only">
          Escribe un mensaje
        </label>
        <Textarea
          ref={textRef}
          id="mensaje"
          name="body"
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          defaultValue={initialText}
          placeholder="Escribe un mensaje…"
          className="min-h-11 flex-1 text-base"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !pending) {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
        />
        <Button type="submit" size="icon-lg" aria-label="Enviar" disabled={pending}>
          <SendHorizontal className="size-5" />
        </Button>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.hint ? (
        <p role="status" className="text-xs text-muted-foreground">
          {state.hint}
        </p>
      ) : null}
    </form>
  );
}
