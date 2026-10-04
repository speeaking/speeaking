import Link from "next/link";
import { Plus } from "lucide-react";
import { pageMetadata } from "@/app/seo";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getViewer } from "@/modules/identity/session";
import { VideoFeed } from "@/modules/social/components/video-feed";
import { listVideoPosts } from "@/modules/social/video-queries";

export const metadata = pageMetadata({
  title: "Videos y Reels",
  description:
    "Descubre los videos de la comunidad de speeaking, comenta y comparte lo que te gusta.",
  path: "/videos",
});

export default async function VideosPage() {
  const viewer = await getViewer();
  const page = await listVideoPosts(viewer?.userId ?? null);
  return (
    <div className="flex flex-col gap-3 pb-8">
      <PageHeader
        title="Videos / Reels"
        description="Historias, ideas y momentos de tu comunidad."
        actions={
          <Link
            href="/crear/publicacion?tipo=video"
            scroll={false}
            className={buttonVariants({
              variant: "secondary",
              className: "min-h-11 gap-1.5 px-3 text-sm",
            })}
          >
            <Plus className="size-4" />
            Subir video
          </Link>
        }
      />
      <VideoFeed initialPage={page} isSignedIn={Boolean(viewer)} />
    </div>
  );
}
