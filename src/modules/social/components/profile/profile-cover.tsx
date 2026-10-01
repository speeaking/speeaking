import { Camera } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { hueFromText, UserAvatar } from "@/components/brand/user-avatar";
import { blurPlaceholder } from "@/lib/image";
import { cn } from "@/lib/utils";
import type { FeedMediaDTO } from "@/modules/feed/dto";

/** Atajo redondo de cámara, como en Facebook: solo en el perfil propio. */
const cameraShortcut =
  "absolute grid size-9 place-items-center rounded-full bg-background/90 text-foreground shadow-md ring-1 ring-foreground/10 backdrop-blur-sm transition-colors hover:bg-background focus-visible:outline-3 focus-visible:outline-ring";

/**
 * Portada del perfil. Con portada propia (ADR-058) se ve nítida; sin ella, su última foto
 * desenfocada y más saturada, como la cabecera de un artista en Spotify, o un tinte suave con «su»
 * tono (ADR-055). El avatar se encima a la portada; una tienda lleva el anillo rosa. En el perfil
 * propio, dos atajos de cámara llevan a Editar perfil.
 */
export function ProfileCover({
  name,
  username,
  avatarUrl,
  cover,
  customCover = false,
  isSeller,
  isOwn = false,
}: {
  name: string;
  username: string;
  avatarUrl: string | null;
  cover: FeedMediaDTO | null;
  /** La portada la eligió la persona: se ve nítida, sin desenfoque. */
  customCover?: boolean;
  isSeller: boolean;
  isOwn?: boolean;
}) {
  return (
    <div className="relative" data-slot="profile-cover">
      <div
        aria-hidden="true"
        className={cn(
          "relative overflow-hidden md:rounded-3xl",
          customCover ? "aspect-[3/1] max-h-56 min-h-36 w-full" : "h-36 md:h-44",
        )}
        style={{ "--hue": hueFromText(username) } as CSSProperties}
      >
        {cover ? (
          <Image
            src={cover.url}
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, 680px"
            {...blurPlaceholder(cover)}
            style={{ objectFit: "cover" }}
            className={customCover ? undefined : "scale-125 blur-2xl saturate-150"}
          />
        ) : (
          <div className="absolute inset-0 community-soft" />
        )}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-b",
            customCover
              ? "from-transparent from-60% to-background/70"
              : "from-transparent via-background/25 to-background",
          )}
        />
      </div>
      {isOwn ? (
        <Link
          href="/perfil/editar"
          aria-label="Cambiar portada"
          className={cn(cameraShortcut, "right-3 bottom-3")}
        >
          <Camera aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
      <div className="absolute -bottom-10 left-4 md:left-6">
        <UserAvatar
          name={name}
          seed={username}
          src={avatarUrl}
          className={cn("size-22 text-2xl ring-4 ring-background", isSeller && "ring-primary")}
        />
        {isOwn ? (
          <Link
            href="/perfil/editar"
            aria-label="Cambiar foto de perfil"
            className={cn(cameraShortcut, "-right-1 bottom-0 size-8")}
          >
            <Camera aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
