import { AppShell } from "@/components/layout/app-shell";
import { SocialAside } from "@/components/layout/social-aside";
import { getNavCommunities, getViewerSummary } from "@/modules/identity/session";

export default async function SocialLayout({ children }: LayoutProps<"/">) {
  const [viewer, communities] = await Promise.all([getViewerSummary(), getNavCommunities()]);
  return (
    <AppShell viewer={viewer} communities={communities} aside={<SocialAside viewer={viewer} />}>
      {children}
    </AppShell>
  );
}
