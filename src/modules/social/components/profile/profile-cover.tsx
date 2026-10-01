import Image from "next/image";
import type { CSSProperties } from "react";
import { hueFromText, UserAvatar } from "@/components/brand/user-avatar";
import { blurPlaceholder } from "@/lib/image";
import { cn } from "@/lib/utils";
import type { FeedMediaDTO } from "@/modules/feed/dto";

/**
 * Portada del perfil (ADR-055): su última foto desenfocada y más saturada, como la cabecera de un
 * artista en Spotify; sin fotos, un tinte suave con «su» tono (el mismo del avatar de iniciales). El
 * avatar se encima a la portada; una tienda lleva el anillo rosa.
 */
export function ProfileCover({
  name,
  username,
  avatarUrl,
  cover,
  isSeller,
}: {
  name: string;
  username: string;
  avatarUrl: string | null;
  cover: FeedMediaDTO | null;
  isSeller: boolean;
}) {
  return (
    <div className="relative" data-slot="profile-cover">
      <div
        aria-hidden="true"
        className="relative h-36 overflow-hidden md:h-44 md:rounded-3xl"
        style={{ "--hue": hueFromText(username) } as CSSProperties}
      >
        {cover ? (
          <Image
            src={cover.url}
            alt=""
            fill
            priority
            sizes="100vw"
            {...blurPlaceholder(cover)}
            style={{ objectFit: "cover" }}
            className="scale-125 blur-2xl saturate-150"
          />
        ) : (
          <div className="absolute inset-0 community-soft" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/25 to-background" />
      </div>
      <UserAvatar
        name={name}
        seed={username}
        src={avatarUrl}
        className={cn(
          "absolute -bottom-10 left-4 size-22 text-2xl ring-4 ring-background md:left-6",
          isSeller && "ring-primary",
        )}
      />
    </div>
  );
}
