import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blend, contrastRatio, isInSrgbGamut, oklchToSrgb, type Oklch } from "@/lib/color";
import { renderCommunityTintCss, type Theme, toneColor, type ToneName } from "./community-tint";

const HUES = Array.from({ length: 360 }, (_, hue) => hue);

/** Superficies neutras de globals.css sobre las que puede ir texto de comunidad. */
const SURFACES: Record<Theme, Record<string, Oklch>> = {
  light: {
    card: [1, 0, 0],
    background: [0.975, 0.003, 270],
    secondary: [0.955, 0.004, 275],
  },
  dark: {
    card: [0.175, 0.004, 285],
    background: [0, 0, 0],
    secondary: [0.235, 0.005, 285],
  },
};

const AA = 4.5;

function worstContrast(theme: Theme, text: ToneName, surface: ToneName | Oklch) {
  let worst = { ratio: Infinity, hue: -1 };
  for (const hue of HUES) {
    const background =
      typeof surface === "string" ? toneColor(surface, theme, hue) : (surface as Oklch);
    const ratio = contrastRatio(oklchToSrgb(toneColor(text, theme, hue)), oklchToSrgb(background));
    if (ratio < worst.ratio) worst = { ratio, hue };
  }
  return worst;
}

describe.each(["light", "dark"] as const)("tintes de comunidad (%s)", (theme) => {
  it("todos los tonos caben en sRGB, así el navegador no recorta ni cambia el contraste", () => {
    const tones: ToneName[] = ["text", "soft", "tile", "bar", "ink", "block", "poster", "lite"];
    const outside = tones.flatMap((tone) =>
      HUES.filter((hue) => !isInSrgbGamut(toneColor(tone, theme, hue), 1e-4)).map(
        (hue) => `${tone}@${hue}`,
      ),
    );

    expect(outside).toEqual([]);
  });

  it.each(Object.keys(SURFACES[theme]))("el texto de comunidad es AA sobre %s", (surface) => {
    expect(worstContrast(theme, "text", SURFACES[theme][surface]!).ratio).toBeGreaterThanOrEqual(
      AA,
    );
  });

  it.each([
    ["text", "soft"],
    ["ink", "soft"],
    ["blockText", "block"],
    ["blockMuted", "block"],
    ["posterText", "poster"],
    ["lite", "poster"],
    ["avatarText", "avatar"],
  ] as const)("%s sobre %s es AA en los 360 tonos", (text, surface) => {
    expect(worstContrast(theme, text, surface).ratio).toBeGreaterThanOrEqual(AA);
  });

  it("el texto blanco al 72 % sigue siendo AA sobre el cartel", () => {
    for (const hue of HUES) {
      const poster = oklchToSrgb(toneColor("poster", theme, hue));
      const faded = blend(oklchToSrgb(toneColor("posterText", theme, hue)), 0.72, poster);
      expect(contrastRatio(faded, poster)).toBeGreaterThanOrEqual(AA);
    }
  });
});

describe("community-tint.css", () => {
  it("está al día con la receta (si falla, ejecuta pnpm tint)", () => {
    const file = readFileSync(new URL("./community-tint.css", import.meta.url), "utf8");

    expect(file.replaceAll("\r\n", "\n")).toBe(renderCommunityTintCss());
  });
});
