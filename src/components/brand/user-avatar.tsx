import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Tonos que no se usan en avatares (ADR-027): la lima es solo de la IA y el turquesa/cian, junto
 * al rosa de la marca, se lee como TikTok. Van en orden ascendente.
 */
export const RESERVED_AVATAR_HUES: ReadonlyArray<readonly [from: number, to: number]> = [
  [105, 135],
  [160, 215],
];
const AVATAR_HUE_RANGE = RESERVED_AVATAR_HUES.reduce(
  (range, [from, to]) => range - (to - from),
  360,
);

/** Tono estable (0–359) a partir de un texto, para que cada persona tenga "su" color. */
export function hueFromText(text: string) {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) % AVATAR_HUE_RANGE;
  // Salta los tonos reservados sin perder uniformidad en el resto de la rueda.
  for (const [from, to] of RESERVED_AVATAR_HUES) if (hash >= from) hash += to - from;
  return hash;
}

/** Conectores en minúscula que no aportan inicial: "Casa y Estilo" → "CE", no "CY". */
const CONNECTORS = new Set(["y", "e", "de", "del", "la", "las", "los"]);

export function initials(name: string) {
  // Solo palabras con letras: "Humor · Equipo" → "HE" (no "H·").
  const words = name
    .trim()
    .split(/\s+/)
    .filter((part) => /\p{L}/u.test(part));
  const meaningful = words.filter((word) => !CONNECTORS.has(word));
  const parts = meaningful.length > 0 ? meaningful : words;
  const letters =
    parts.length > 1 ? `${parts[0]![0]}${parts[1]![0]}` : (parts[0]?.slice(0, 2) ?? "?");
  return letters.toUpperCase();
}

/** Avatar con foto o, si no hay, iniciales sobre un color propio de la persona. */
export function UserAvatar({
  name,
  seed,
  src,
  className,
}: {
  name: string;
  seed: string;
  src?: string | null;
  className?: string;
}) {
  const hue = hueFromText(seed);
  return (
    <span
      className={cn(
        "relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full avatar-tint font-heading text-sm font-bold",
        className,
      )}
      style={{ "--hue": hue } as CSSProperties}
      aria-hidden="true"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatares pequeños servidos por nuestra app
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
