"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteCommunityAction } from "../actions";
import type { CommunityFormState } from "../schemas";

export function DeleteCommunityForm({ communityId, name }: { communityId: string; name: string }) {
  const [state, action, pending] = useActionState<CommunityFormState, FormData>(
    deleteCommunityAction,
    {},
  );
  const [confirmation, setConfirmation] = useState("");
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="communityId" value={communityId} />
      <p className="text-sm text-muted-foreground">
        Se eliminarán el grupo, sus membresías y sus invitaciones. Las publicaciones conservarán sus
        autores y su privacidad, sin pertenecer al grupo. Este cambio no se puede deshacer.
      </p>
      <label htmlFor="delete-community-name" className="text-sm font-semibold">
        Para confirmar escribe: {name}
      </label>
      <Input
        id="delete-community-name"
        name="confirmation"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        maxLength={80}
        autoComplete="off"
        disabled={pending}
        className="min-h-11"
      />
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="destructive"
        disabled={pending || confirmation.trim() !== name}
        className="min-h-11 self-start"
      >
        {pending ? "Eliminando…" : "Eliminar comunidad"}
      </Button>
    </form>
  );
}
