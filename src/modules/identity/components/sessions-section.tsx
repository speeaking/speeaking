import { MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/format";
import { signOutEverywhereAction } from "../actions";
import { getSession } from "../session";
import { listOpenSessions, type OpenSessionDTO } from "../sessions";

/** «Tus sesiones» para Ajustes (SEC-10): dónde está abierta la cuenta y cerrarlas todas. */
export async function SessionsSection() {
  const session = await getSession();
  if (!session) return null;
  const sessions = await listOpenSessions(session.user.id, session.session.id);
  return <SessionsList sessions={sessions} />;
}

export function SessionsList({
  sessions,
  now = new Date(),
}: {
  sessions: OpenSessionDTO[];
  now?: Date;
}) {
  return (
    <section
      aria-labelledby="tus-sesiones"
      className="flex flex-col gap-3 rounded-3xl border bg-card p-4"
    >
      <h2 id="tus-sesiones" className="flex items-center gap-2 font-heading text-lg font-bold">
        <MonitorSmartphone aria-hidden="true" className="size-5" />
        Tus sesiones
      </h2>
      <p className="text-sm text-muted-foreground">
        Dispositivos donde tu cuenta está abierta. Si no reconoces alguno, cierra la sesión en todos.
      </p>
      <ul className="flex flex-col divide-y">
        {sessions.map((session) => (
          <li key={session.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="font-medium">{session.device}</span>
            <span className="shrink-0 text-muted-foreground">
              {session.current
                ? "Este dispositivo"
                : `Activa ${formatRelativeTime(session.lastActiveAt, now)}`}
            </span>
          </li>
        ))}
      </ul>
      <form action={signOutEverywhereAction} className="flex flex-col gap-1.5">
        <Button type="submit" variant="outline" className="self-start">
          Cerrar sesión en todos los dispositivos
        </Button>
        <p className="text-xs text-muted-foreground">
          Incluye este dispositivo: tendrás que volver a entrar.
        </p>
      </form>
    </section>
  );
}
