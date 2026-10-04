import { PageHeader } from "@/components/layout/page-header";

export default function LoadingVideos() {
  return (
    <div aria-label="Cargando videos" aria-busy="true">
      <PageHeader title="Videos / Reels" />
      <div className="mx-4 h-[65dvh] rounded-3xl bg-secondary motion-safe:animate-pulse md:mx-0" />
    </div>
  );
}
