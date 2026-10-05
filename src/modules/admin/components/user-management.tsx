"use client";

import { Ban, LockKeyhole, ShieldCheck, Trash2 } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adminUserAction, type AdminUserActionState } from "../user-actions";
import { ADMIN_USER_REASON_MAX, type AdminUserActionInput } from "../user-schemas";
import type { AdminUserRow } from "../user-service";

type Action = AdminUserActionInput["action"];

export function UserManagement({ user }: { user: AdminUserRow }) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  if (user.status === "deleted") {
    return <span className="text-xs text-muted-foreground">Registro anonimizado</span>;
  }
  if (user.isProtected) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <LockKeyhole className="size-3.5" />
        {user.isSelf ? "Tu cuenta · protegida" : "Administrador protegido"}
      </span>
    );
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) setAction(null);
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="h-11 px-4"
            aria-label={`Administrar la cuenta de ${user.displayName}`}
          />
        }
      >
        Administrar
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>Administrar cuenta</DialogTitle>
          <DialogDescription className="break-words">
            {user.displayName}
            <br />
            <span className="break-all">{user.email}</span>
          </DialogDescription>
        </DialogHeader>
        {user.blockedReason ? (
          <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm">
            <p className="font-medium">Cuenta bloqueada</p>
            <p className="mt-1 break-words whitespace-pre-wrap text-muted-foreground">
              {user.blockedReason}
            </p>
          </div>
        ) : null}
        {!action ? (
          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => setAction(user.status === "blocked" ? "unblock" : "block")}
              className="flex min-h-20 items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {user.status === "blocked" ? (
                <ShieldCheck className="mt-0.5 size-5 shrink-0" />
              ) : (
                <Ban className="mt-0.5 size-5 shrink-0" />
              )}
              <span>
                <span className="block font-semibold">
                  {user.status === "blocked" ? "Desbloquear cuenta" : "Bloquear cuenta"}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {user.status === "blocked"
                    ? "Podrá volver a entrar con su cuenta. Tendrá que iniciar sesión otra vez."
                    : "Se cerrarán sus sesiones. No podrá entrar ni publicar hasta que la desbloquees."}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAction("delete")}
              className="flex min-h-20 items-start gap-3 rounded-xl border border-destructive/25 p-4 text-left transition-colors hover:bg-destructive/5 focus-visible:ring-2 focus-visible:ring-destructive focus-visible:outline-none"
            >
              <Trash2 className="mt-0.5 size-5 shrink-0 text-destructive" />
              <span>
                <span className="block font-semibold text-destructive">Eliminar cuenta</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Elimina su cuenta y contenido. Si tiene pedidos, conserva sus registros con la
                  cuenta anonimizada.
                </span>
              </span>
            </button>
          </div>
        ) : (
          <UserActionForm
            key={action}
            user={user}
            action={action}
            onBack={() => setAction(null)}
            onPending={setBusy}
            onDone={() => {
              setOpen(false);
              setAction(null);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function UserActionForm({
  user,
  action,
  onBack,
  onPending,
  onDone,
}: {
  user: AdminUserRow;
  action: Action;
  onBack: () => void;
  onPending: (pending: boolean) => void;
  onDone: () => void;
}) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [email, setEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [state, formAction, pending] = useActionState<AdminUserActionState, FormData>(
    async (previous, formData) => {
      onPending(true);
      try {
        const result = await adminUserAction(previous, formData);
        if (result.ok) {
          toast.success(result.message);
          onDone();
        }
        return result;
      } catch {
        return {
          error:
            "No pudimos conectar. Actualiza la lista para revisar el estado de la cuenta antes de intentar otra vez.",
        };
      } finally {
        onPending(false);
      }
    },
    {},
  );
  const label =
    action === "delete"
      ? "Eliminar cuenta"
      : action === "block"
        ? "Bloquear cuenta"
        : "Desbloquear cuenta";
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="userId" value={user.id} />
      <input type="hidden" name="action" value={action} />
      <h3 className="font-semibold">{label}</h3>
      {action === "delete" ? (
        <p className="text-sm text-muted-foreground">
          La eliminación es permanente. Las publicaciones, fotos y relaciones de esta cuenta se
          quitarán. Los registros de pedidos se conservan cuando corresponde.
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-reason`} className="text-sm font-medium">
          Motivo interno
        </label>
        <Textarea
          id={`${id}-reason`}
          name="reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explica por qué realizas esta acción"
          minLength={3}
          maxLength={ADMIN_USER_REASON_MAX}
          rows={3}
          required
          disabled={pending}
        />
      </div>
      {action === "delete" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-email`} className="text-sm font-medium">
            Escribe el correo de la cuenta para confirmar
          </label>
          <Input
            id={`${id}-email`}
            name="confirmationEmail"
            type="text"
            autoComplete="off"
            spellCheck={false}
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={320}
            required
            disabled={pending}
            className="h-11"
          />
        </div>
      ) : null}
      <label className="flex min-h-11 items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="confirmed"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          required
          disabled={pending}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        {action === "delete"
          ? "Confirmo la eliminación permanente de esta cuenta."
          : action === "block"
            ? "Confirmo el bloqueo y el cierre de sus sesiones."
            : "Confirmo que esta cuenta puede volver a entrar."}
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={pending}
          className="h-11 px-4"
        >
          Volver
        </Button>
        <Button
          type="submit"
          variant={action === "delete" ? "destructive" : "default"}
          disabled={
            pending ||
            !confirmed ||
            reason.trim().length < 3 ||
            (action === "delete" && email.trim().toLowerCase() !== user.email.toLowerCase())
          }
          className="h-11 px-4"
        >
          {pending ? "Guardando…" : label}
        </Button>
      </div>
    </form>
  );
}
