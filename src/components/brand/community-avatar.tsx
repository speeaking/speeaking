import type { CSSProperties } from "react";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";

const SIZES = {
  sm: { tile: "size-8 rounded-md text-base", seal: "size-4 -right-1 -bottom-1" },
  md: { tile: "size-12 rounded-xl text-2xl", seal: "size-5 -right-1 -bottom-1" },
  lg: { tile: "size-16 rounded-2xl text-4xl", seal: "size-6 -right-1.5 -bottom-1.5" },
} as const;

export type CommunityAvatarSize = keyof typeof SIZES;

/**
 * Avatar de comunidad: su emoji sobre su color (`community-tile`), en un cuadrado redondeado como
 * ícono de app. `editorial` agrega el sello de speeaking (el isotipo) para las cuentas del equipo.
 *
 * Accesibilidad: el emoji nunca se lee. Si el nombre de la comunidad ya está visible junto al
 * avatar, usa `decorative` para que el lector de pantalla no lo repita; si no, el avatar se
 * anuncia como imagen con el nombre.
 */
export function CommunityAvatar({
  name,
  emoji,
  hue,
  size = "md",
  editorial = false,
  decorative = false,
  className,
}: {
  name: string;
  emoji: string;
  hue: number;
  size?: CommunityAvatarSize;
  editorial?: boolean;
  decorative?: boolean;
  className?: string;
}) {
  const label = editorial ? `${name}, cuenta editorial de ${siteConfig.name}` : name;
  return (
    <span
      style={{ "--hue": hue } as CSSProperties}
      className={cn(
        "relative grid shrink-0 place-items-center community-tile leading-none select-none",
        SIZES[size].tile,
        className,
      )}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
    >
      <span aria-hidden="true">{emoji}</span>
      {editorial ? (
        <span
          className={cn(
            "absolute grid place-items-center rounded-full bg-card p-px ring-2 ring-card",
            SIZES[size].seal,
          )}
        >
          <BrandMark className="size-full" />
        </span>
      ) : null}
    </span>
  );
}
