import { AppShell } from "@/components/layout/app-shell";
import { SocialAside } from "@/components/layout/social-aside";
import { getNavCommunities, getViewerSummary } from "@/modules/identity/session";

/** `modal`: slot paralelo (@modal) para abrir publicaciones en capa sobre el feed (ADR-052). */
export default async function SocialLayout({ children, modal }: LayoutProps<"/">) {
  const [viewer, communities] = await Promise.all([getViewerSummary(), getNavCommunities()]);
  return (
    <AppShell viewer={viewer} communities={communities} aside={<SocialAside viewer={viewer} />}>
      {children}
      {modal}
    </AppShell>
  );
}
