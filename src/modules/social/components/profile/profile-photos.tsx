import { Images } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { EmptyState } from "@/components/states/empty-state";
import { blurPlaceholder } from "@/lib/image";
import type { ProfilePhoto } from "../../profile-copy";

/** Pestaña «Fotos» (ADR-055): cuadrícula de 3 columnas; cada foto abre su publicación (en capa). */
export function ProfilePhotos({ photos, name }: { photos: ProfilePhoto[]; name: string }) {
  if (photos.length === 0) {
    return (
      <div className="px-4 md:px-0">
        <EmptyState
          icon={Images}
          title="Sin fotos todavía"
          description="Las fotos de sus publicaciones aparecen aquí."
        />
      </div>
    );
  }
  return (
    <ul aria-label={`Fotos de ${name}`} className="grid grid-cols-3 gap-0.5 md:gap-1">
      {photos.map(({ postId, media }, index) => (
        <li
          key={`${postId}-${index}`}
          className="relative aspect-square overflow-hidden bg-muted md:rounded-xl"
        >
          <Link
            href={`/p/${postId}` as Route}
            aria-label={media.alt?.trim() || `Foto ${index + 1}`}
            className="block size-full"
          >
            <Image
              src={media.url}
              alt=""
              fill
              sizes="(max-width: 768px) 33vw, 227px"
              {...blurPlaceholder(media)}
              style={{ objectFit: "cover" }}
              className="transition-transform duration-300 hover:scale-105 motion-reduce:transition-none"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
