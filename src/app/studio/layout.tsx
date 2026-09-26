import type { Metadata } from "next";
import { StudioShell } from "@/components/layout/studio-shell";

export const metadata: Metadata = { title: { default: "Studio", template: "%s · Studio" } };

export default function StudioLayout({ children }: LayoutProps<"/studio">) {
  return <StudioShell>{children}</StudioShell>;
}
