import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { RemoveContentButton } from "@/modules/identity/components/remove-content-button";
import { NotificationCenter } from "@/modules/notifications/components/notification-center";
import { groupNotifications } from "@/modules/notifications/group";
import { listNotifications } from "@/modules/notifications/queries";

export const metadata: Metadata = {
  title: "Notificaciones",
  robots: { index: false, follow: false },
};

/**
 * La campana (ADR-059): quién reaccionó, comentó o empezó a seguirte, y los pedidos que cambian de
 * estado. Las menciones y las solicitudes tienen acceso directo a donde ocurrió la actividad.
 */
export default async function NotificationsPage() {
  const viewer = await requireOnboardedViewer("/avisos");
  const items = groupNotifications(await listNotifications(viewer.userId), viewer.profile.username);

  return (
    <div className="flex flex-col gap-2 pb-8">
      <PageHeader
        title="Notificaciones"
        description="Tu actividad, tus amigos y tus compras, en un solo lugar."
        actions={
          items.length ? (
            <RemoveContentButton kind="notifications" id="all" label="Borrar todos" />
          ) : undefined
        }
      />
      <NotificationCenter items={items} />
    </div>
  );
}
