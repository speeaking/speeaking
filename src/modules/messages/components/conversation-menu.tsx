"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Ban, ChevronDown, CircleUser, Flag, Maximize2, ShieldCheck } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/brand/user-avatar";
import { Button } from "@/components/ui/button";
import { PROFILE_TRANSITION } from "@/lib/page-turn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ReportDialog } from "@/modules/trust/components/report-button";
import { RemoveContentButton } from "@/modules/identity/components/remove-content-button";
import { setMessagesBlockedAction } from "../actions";
import type { PersonDTO, ThreadBlock } from "../service";

const itemClass =
  "flex min-h-10 items-center gap-2.5 rounded-md px-2 text-sm font-medium outline-none select-none focus:bg-accent focus:text-accent-foreground data-highlighted:bg-accent [&_svg]:size-4 [&_svg]:text-muted-foreground";

/**
 * Bloquear o desbloquear los mensajes de la otra persona; avisa con un toast y vuelve a pedir el
 * hilo (`onChanged` en el recuadro; en la página, la página).
 */
function useBlockToggle(conversationId: string, name: string, onChanged?: () => void) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const setBlocked = (blocked: boolean) =>
    startTransition(async () => {
      const result = await setMessagesBlockedAction(conversationId, blocked);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        blocked
          ? `Bloqueaste los mensajes de ${name}. Ya no podrá escribirte.`
          : `Desbloqueaste los mensajes de ${name}.`,
      );
      if (onChanged) onChanged();
      else router.refresh();
    });
  return { pending, setBlocked };
}

/**
 * Lo que se puede hacer con una conversación al tocar a la otra persona (ADR-069), como en
 * Messenger pero solo lo que aplica aquí: ver su perfil, abrir el hilo en Mensajes (desde el
 * recuadro), bloquear o desbloquear sus mensajes y reportarla. Desde el recuadro, «Reportar» abre
 * el hilo en Mensajes con el formulario listo (un diálogo encima del recuadro lo cerraría).
 */
export function ConversationMenu({
  conversationId,
  other,
  blocked,
  inPanel = false,
  reportOnOpen = false,
  onChanged,
}: {
  conversationId: string;
  other: PersonDTO;
  blocked: ThreadBlock;
  /** En el recuadro de la barra (ADR-068). */
  inPanel?: boolean;
  /** Llegó con `?reportar=1`: el formulario de reporte abre de inmediato. */
  reportOnOpen?: boolean;
  /** Cambió el bloqueo: hay que volver a pedir el hilo (sin él, se refresca la página). */
  onChanged?: () => void;
}) {
  const [reportOpen, setReportOpen] = useState(reportOnOpen);
  const { pending, setBlocked } = useBlockToggle(conversationId, other.displayName, onChanged);
  const threadPath = `/mensajes/${conversationId}`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Opciones de la conversación con ${other.displayName}`}
          className="flex min-w-0 items-center gap-2 rounded-full py-1 pr-2 pl-1 text-left outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring data-popup-open:bg-secondary"
        >
          <UserAvatar
            name={other.displayName}
            seed={other.username || other.displayName}
            src={other.avatarUrl}
            className={cn("shrink-0", inPanel ? "size-8" : "size-9")}
          />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate">{other.displayName}</span>
            {!inPanel && other.username ? (
              <span className="truncate text-xs font-normal text-muted-foreground">
                @{other.username}
              </span>
            ) : null}
          </span>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8} className="w-60 rounded-2xl p-1.5">
          {other.username ? (
            <MenuPrimitive.LinkItem
              closeOnClick
              render={
                <Link href={`/u/${other.username}` as Route} transitionTypes={PROFILE_TRANSITION} />
              }
              className={itemClass}
            >
              <CircleUser />
              Ver perfil
            </MenuPrimitive.LinkItem>
          ) : null}
          {inPanel ? (
            <MenuPrimitive.LinkItem
              closeOnClick
              render={<Link href={threadPath as Route} />}
              className={itemClass}
            >
              <Maximize2 />
              Abrir en Mensajes
            </MenuPrimitive.LinkItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className={itemClass}
            disabled={pending}
            onClick={() => setBlocked(blocked !== "byMe")}
          >
            {blocked === "byMe" ? <ShieldCheck /> : <Ban />}
            {blocked === "byMe" ? "Desbloquear mensajes" : "Bloquear mensajes"}
          </DropdownMenuItem>
          {inPanel ? (
            <MenuPrimitive.LinkItem
              closeOnClick
              render={<Link href={`${threadPath}?reportar=1` as Route} />}
              className={itemClass}
            >
              <Flag />
              Reportar
            </MenuPrimitive.LinkItem>
          ) : (
            <DropdownMenuItem className={itemClass} onClick={() => setReportOpen(true)}>
              <Flag />
              Reportar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {!inPanel ? (
        <RemoveContentButton
          kind="conversation"
          id={conversationId}
          label="Eliminar conversación"
          compact
          description="Se borrará tu historial con esta persona. La otra persona conserva su copia. Si vuelven a escribir, verás los mensajes nuevos."
        />
      ) : null}
      {inPanel ? null : (
        <ReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          targetType="USER"
          targetId={other.userId}
        />
      )}
    </>
  );
}

/**
 * En lugar del campo para escribir cuando hay un bloqueo (ADR-069). A quien bloqueó se le dice y
 * puede quitarlo; a la otra persona solo se le dice que no puede responder (sin «te bloqueó»).
 */
export function BlockedNotice({
  conversationId,
  name,
  blocked,
  onChanged,
}: {
  conversationId: string;
  name: string;
  blocked: Exclude<ThreadBlock, null>;
  onChanged?: () => void;
}) {
  const { pending, setBlocked } = useBlockToggle(conversationId, name, onChanged);
  if (blocked === "byThem") {
    return (
      <p role="status" className="py-1 text-center text-sm text-muted-foreground">
        No puedes responder a esta conversación.
      </p>
    );
  }
  return (
    <div role="status" className="flex flex-col items-center gap-2 py-1 text-center text-sm">
      <p className="text-muted-foreground">
        Bloqueaste los mensajes de {name}. Ya no puede escribirte.
      </p>
      <Button variant="outline" disabled={pending} onClick={() => setBlocked(false)}>
        Desbloquear
      </Button>
    </div>
  );
}
