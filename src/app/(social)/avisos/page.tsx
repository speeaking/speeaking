import { Bell } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { MarkNotificationsRead } from "@/modules/notifications/components/mark-read";
import { NotificationList } from "@/modules/notifications/components/notification-list";
import { groupNotifications } from "@/modules/notifications/group";
import { listNotifications } from "@/modules/notifications/queries";

export const metadata: Metadata = { title: "Avisos" };

/**
 * La campana (ADR-059): quién reaccionó, comentó o empezó a seguirte, y los pedidos que cambian de
 * estado. Al abrirla quedan leídos.
 */
export default async function NotificationsPage() {
  const viewer = await requireOnboardedViewer("/avisos");
  const items = groupNotifications(await listNotifications(viewer.userId), viewer.profile.username);
  const unread = items.filter((item) => item.unread).length;

  return (
    <div className="flex flex-col gap-2 pb-8">
      <PageHeader title="Avisos" />
      <MarkNotificationsRead unread={unread} />
      {items.length === 0 ? (
        <div className="px-4 md:px-0">
          <EmptyState
            icon={Bell}
            title="Todavía no tienes avisos"
            description="Aquí verás quién reacciona, comenta o empieza a seguirte, y cómo van tus pedidos."
          />
        </div>
      ) : (
        <div className="px-1 md:px-0">
          <NotificationList items={items} />
        </div>
      )}
    </div>
  );
}
