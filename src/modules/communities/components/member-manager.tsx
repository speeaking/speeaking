"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Crown, ShieldCheck, UserPlus } from "lucide-react";
import { UserAvatar } from "@/components/brand/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CommunityMember, MemberTab } from "../queries";
import { manageCommunityAction } from "../actions";
import type { CommunityCommand } from "../schemas";

export function MemberManager({
  communityId,
  viewerId,
  people,
  tab,
  canManage,
  isOwner,
}: {
  communityId: string;
  viewerId: string;
  people: CommunityMember[];
  tab: MemberTab;
  canManage: boolean;
  isOwner: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [username, setUsername] = useState("");
  const [notice, setNotice] = useState<{ error?: string; message?: string } | null>(null);
  const [confirmation, setConfirmation] = useState<{
    person: CommunityMember;
    command: CommunityCommand;
  } | null>(null);
  const router = useRouter();
  function run(command: CommunityCommand, targetId?: string) {
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await manageCommunityAction({
          communityId,
          command,
          ...(command === "invite" ? { username } : { targetId }),
        });
        if (!result.ok) {
          setNotice({ error: result.error });
          return;
        }
        setNotice({ message: result.message });
        setConfirmation(null);
        if (command === "invite") setUsername("");
        router.refresh();
      } catch {
        setNotice({ error: "No pudimos guardar el cambio. Intenta de nuevo." });
      }
    });
  }
  const labels: Partial<Record<CommunityCommand, string>> = {
    remove: "Retirar miembro",
    promote: "Nombrar administrador",
    demote: "Quitar administración",
    transfer: "Transferir propiedad",
  };
  return (
    <div className="flex flex-col gap-4">
      {canManage ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            run("invite");
          }}
          className="flex flex-col gap-3 rounded-2xl border bg-card p-4"
        >
          <label htmlFor="invite-username" className="flex items-center gap-2 font-semibold">
            <UserPlus className="size-4" />
            Invitar a una persona
          </label>
          <div className="flex gap-2">
            <Input
              id="invite-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="@usuario"
              required
              maxLength={31}
              disabled={pending}
              className="min-h-11 min-w-0 flex-1"
            />
            <Button type="submit" disabled={pending || !username.trim()} className="min-h-11">
              Invitar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Recibirá una notificación y elegirá si quiere unirse. Usa su @usuario, no su correo.
          </p>
        </form>
      ) : null}
      {notice ? (
        <p
          role={notice.error ? "alert" : "status"}
          className={notice.error ? "text-sm text-destructive" : "text-sm text-primary-text"}
        >
          {notice.error ?? notice.message}
        </p>
      ) : null}
      {!people.length ? (
        <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
          No hay personas para mostrar en esta vista.
        </p>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {people.map((person) => (
            <li key={person.userId} className="flex flex-col gap-3 p-4">
              <Link
                href={`/u/${person.username}` as Route}
                className="flex min-w-0 items-center gap-3"
              >
                <UserAvatar
                  name={person.displayName}
                  seed={person.username}
                  src={person.avatarUrl}
                  className="size-11 shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {person.displayName}
                    {person.userId === viewerId ? " (tú)" : ""}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    @{person.username}
                  </span>
                </span>
                {tab === "miembros" && (person.isOwner || person.role === "ADMIN") ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs font-semibold">
                    {person.isOwner ? (
                      <Crown className="size-3.5" />
                    ) : (
                      <ShieldCheck className="size-3.5" />
                    )}
                    {person.isOwner ? "Propietario" : "Admin"}
                  </span>
                ) : null}
              </Link>
              {canManage && !person.isOwner && person.userId !== viewerId ? (
                <div className="flex flex-wrap gap-2">
                  {tab === "invitaciones" ? (
                    <Button
                      variant="outline"
                      disabled={pending}
                      className="min-h-11"
                      onClick={() => run("cancelInvite", person.userId)}
                    >
                      Cancelar invitación
                    </Button>
                  ) : tab === "retirados" ? (
                    <Button
                      variant="outline"
                      disabled={pending}
                      className="min-h-11"
                      onClick={() => run("restore", person.userId)}
                    >
                      Permitir volver
                    </Button>
                  ) : (
                    <>
                      {isOwner ? (
                        <>
                          <Button
                            variant="outline"
                            disabled={pending}
                            className="min-h-11"
                            onClick={() =>
                              setConfirmation({
                                person,
                                command: person.role === "ADMIN" ? "demote" : "promote",
                              })
                            }
                          >
                            {person.role === "ADMIN"
                              ? "Quitar administración"
                              : "Hacer administrador"}
                          </Button>
                          <Button
                            variant="outline"
                            disabled={pending}
                            className="min-h-11"
                            onClick={() => setConfirmation({ person, command: "transfer" })}
                          >
                            Transferir propiedad
                          </Button>
                        </>
                      ) : null}
                      {isOwner || person.role !== "ADMIN" ? (
                        <Button
                          variant="destructive"
                          disabled={pending}
                          className="min-h-11"
                          onClick={() => setConfirmation({ person, command: "remove" })}
                        >
                          Retirar del grupo
                        </Button>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open && !pending) setConfirmation(null);
        }}
      >
        <DialogContent showCloseButton={!pending}>
          <DialogTitle>
            {confirmation ? labels[confirmation.command] : "Confirmar cambio"}
          </DialogTitle>
          <DialogDescription>
            {confirmation?.command === "transfer"
              ? `¿Transferir la comunidad a ${confirmation.person.displayName}? Esta persona podrá nombrar administradores y cambiar la propiedad. Tú seguirás como administrador y dejarás de tener el control de los roles.`
              : confirmation?.command === "remove"
                ? `¿Retirar a ${confirmation.person.displayName}? Ya no podrá publicar ni volver a unirse hasta que le permitas regresar. Sus publicaciones conservan su privacidad.`
                : confirmation?.command === "promote"
                  ? `${confirmation.person.displayName} podrá invitar y retirar miembros. Solo tú podrás cambiar administradores o transferir la propiedad.`
                  : `${confirmation?.person.displayName ?? "Esta persona"} seguirá como miembro y perderá sus permisos de administración.`}
          </DialogDescription>
          {notice?.error ? (
            <p role="alert" className="text-sm text-destructive">
              {notice.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              className="min-h-11"
              onClick={() => setConfirmation(null)}
            >
              Cancelar
            </Button>
            <Button
              disabled={pending}
              className="min-h-11"
              onClick={() => {
                if (confirmation) run(confirmation.command, confirmation.person.userId);
              }}
            >
              {pending ? "Guardando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
