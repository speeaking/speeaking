/**
 * Matemática de color mínima (OKLCH → sRGB y contraste WCAG 2.x) para generar y auditar los tintes
 * de comunidad. No se usa en el navegador: la ocupan `src/styles/community-tint.ts` y sus pruebas.
 */

export type Oklch = readonly [lightness: number, chroma: number, hue: number];
type Rgb = readonly [number, number, number];

/** OKLCH → sRGB lineal, sin recortar (los valores fuera de [0, 1] están fuera de gama). */
export function oklchToLinearSrgb([lightness, chroma, hue]: Oklch): Rgb {
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function isInSrgbGamut(color: Oklch, tolerance = 1e-6) {
  return oklchToLinearSrgb(color).every((v) => v >= -tolerance && v <= 1 + tolerance);
}

/** Croma máximo que cabe en sRGB para una luminosidad y un tono dados. */
export function maxSrgbChroma(lightness: number, hue: number) {
  let low = 0;
  let high = 0.5;
  for (let step = 0; step < 32; step += 1) {
    const mid = (low + high) / 2;
    if (isInSrgbGamut([lightness, mid, hue])) low = mid;
    else high = mid;
  }
  return low;
}

const encode = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const decode = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * sRGB codificado (0–1) como lo pinta un navegador en una pantalla sRGB: los canales fuera de gama
 * se recortan. Por eso un color fuera de gama cambia de luminancia y puede perder contraste.
 */
export function oklchToSrgb(color: Oklch): Rgb {
  const [r, g, b] = oklchToLinearSrgb(color).map((v) => encode(clamp01(v)));
  return [r!, g!, b!];
}

export function srgbToHex(rgb: Rgb) {
  return `#${rgb
    .map((v) =>
      Math.round(clamp01(v) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** Mezcla `top` con opacidad `alpha` sobre `bottom` (en sRGB codificado, como el navegador). */
export function blend(top: Rgb, alpha: number, bottom: Rgb): Rgb {
  return [0, 1, 2].map((i) => top[i]! * alpha + bottom[i]! * (1 - alpha)) as unknown as Rgb;
}

function luminance(rgb: Rgb) {
  const [r, g, b] = rgb.map(decode);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** Contraste WCAG 2.x entre dos colores sRGB codificados. */
export function contrastRatio(a: Rgb, b: Rgb) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high! + 0.05) / (low! + 0.05);
}
