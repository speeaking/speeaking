"use client";

import { Check, LoaderCircle, UserPlus, UserRoundCheck, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { friendshipAction } from "../actions";
import type { FriendshipCommand, FriendshipState } from "../types";

export function FriendshipButton({
  targetId,
  name,
  initialState,
  isSignedIn = true,
}: {
  targetId: string;
  name: string;
  initialState: FriendshipState;
  isSignedIn?: boolean;
}) {
  const [result, setResult] = useState<{ source: FriendshipState; state: FriendshipState }>({
    source: initialState,
    state: initialState,
  });
  const state = result.source === initialState ? result.state : initialState;
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  if (state === "self" || state === "unavailable") return null;
  const act = (command: FriendshipCommand) => {
    if (!isSignedIn) {
      router.push(`/entrar?next=${encodeURIComponent(pathname)}` as Route);
      return;
    }
    if (
      command === "remove" &&
      !window.confirm(
        `¿Quitar a ${name} de tus amigos? Dejarán de ver su contenido personal mutuamente.`,
      )
    )
      return;
    startTransition(async () => {
      try {
        const next = await friendshipAction(targetId, command);
        if (!next.ok) {
          toast.error(next.error);
          if (next.needsAuth) router.push(`/entrar?next=${encodeURIComponent(pathname)}` as Route);
          return;
        }
        setResult({ source: initialState, state: next.state });
        if (command === "request" && next.state === "outgoing") toast.success("Solicitud enviada");
        if (command === "accept" && next.state === "friends")
          toast.success(`Ahora tú y ${name} son amigos`);
        router.refresh();
      } catch {
        toast.error("No pudimos actualizar la amistad. Intenta de nuevo.");
      }
    });
  };
  const spinner = pending ? (
    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
  ) : null;
  if (state === "incoming")
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          className="min-h-11 md:min-h-10"
          disabled={pending}
          onClick={() => act("accept")}
          aria-label={`Aceptar la amistad de ${name}`}
        >
          {spinner ?? <Check aria-hidden="true" />} Aceptar
        </Button>
        <Button
          className="min-h-11 md:min-h-10"
          variant="outline"
          disabled={pending}
          onClick={() => act("decline")}
          aria-label={`Rechazar la solicitud de ${name}`}
        >
          Rechazar
        </Button>
      </div>
    );
  const labels = { none: "Agregar amigo", outgoing: "Cancelar solicitud", friends: "Amigos" };
  const icons = { none: UserPlus, outgoing: X, friends: UserRoundCheck };
  const Icon = icons[state];
  return (
    <Button
      className="min-h-11 md:min-h-10"
      variant={state === "none" ? "default" : "outline"}
      disabled={pending}
      onClick={() => act(state === "none" ? "request" : state === "outgoing" ? "cancel" : "remove")}
      title={state === "friends" ? "Quitar amistad" : undefined}
      aria-label={
        state === "friends" ? `Amigos: quitar a ${name} de tus amigos` : `${labels[state]}: ${name}`
      }
    >
      {spinner ?? <Icon aria-hidden="true" />} {labels[state]}
    </Button>
  );
}
