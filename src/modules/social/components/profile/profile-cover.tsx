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
 * propio, dos atajos de cámara llevan a Editar perfil. En escritorio (ADR-065) la portada va ancha,
 * pegada a la barra de arriba y con las esquinas de abajo redondeadas, y el avatar crece.
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
          "relative overflow-hidden md:rounded-b-3xl",
          customCover
            ? "aspect-[3/1] max-h-56 min-h-36 w-full lg:max-h-[22rem]"
            : "h-36 md:h-44 lg:h-60",
        )}
        style={{ "--hue": hueFromText(username) } as CSSProperties}
      >
        {cover ? (
          <Image
            src={cover.url}
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, 992px"
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
          className={cn(
            cameraShortcut,
            "right-3 bottom-3 lg:right-5 lg:bottom-5 lg:flex lg:w-auto lg:items-center lg:gap-2 lg:rounded-lg lg:px-3 lg:text-sm lg:font-semibold",
          )}
        >
          <Camera aria-hidden="true" className="size-4" />
          <span aria-hidden="true" className="hidden lg:inline">
            Editar portada
          </span>
        </Link>
      ) : null}
      <div className="absolute -bottom-10 left-4 md:left-6 lg:-bottom-24 lg:left-8">
        <UserAvatar
          name={name}
          seed={username}
          src={avatarUrl}
          className={cn(
            "size-22 text-2xl ring-4 ring-background lg:size-40 lg:text-5xl",
            isSeller && "ring-primary",
          )}
        />
        {isOwn ? (
          <Link
            href="/perfil/editar"
            aria-label="Cambiar foto de perfil"
            className={cn(
              cameraShortcut,
              "-right-1 bottom-0 size-8 lg:right-2 lg:bottom-2 lg:size-9",
            )}
          >
            <Camera aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
