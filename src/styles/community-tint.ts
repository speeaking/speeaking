/**
 * Receta de color por comunidad (ADR-027). Cada comunidad trae su tono (`Community.hue`, 0–359) y
 * la interfaz lo pinta con utilidades de Tailwind que leen la propiedad `--hue`:
 *
 *   <div style={{ "--hue": community.hue }} className="community-block">…</div>
 *
 * Este archivo es la fuente de verdad: `pnpm tint` genera `community-tint.css` a partir de él y
 * `community-tint.test.ts` audita el contraste AA en los 360 tonos, en claro y en oscuro.
 *
 * Dos detalles que no se ven a simple vista:
 * - **Gama sRGB.** Un croma fijo se sale de sRGB en muchos tonos (los cian y azules claros, por
 *   ejemplo). El navegador recorta el color, cambia su luminancia y el contraste cae (Autos medía
 *   4.38:1). Por eso el croma se limita, tono por tono, con una función lineal por tramos que
 *   siempre queda dentro de la gama: `min(croma, tope(h))`.
 * - **`--lift`.** Aclara solo los amarillos y verdes oliva (h ≈ 45–135) de los mosaicos, barras y
 *   bloques para que no se vean mostaza ni café. (La receta de la maqueta también aclaraba, sin
 *   querer, los violetas alrededor de h = 270; aquí se apaga desde h = 180.)
 */
import { maxSrgbChroma, type Oklch } from "@/lib/color";

export type Theme = "light" | "dark";

/** Un tono de comunidad: luminosidad y croma; `lift` suma luminosidad a los amarillos. */
type HueTone = { l: number; c: number; lift?: number };
/** Un color neutro fijo (no depende del tono), en OKLCH. */
type FixedTone = { fixed: Oklch };
type Tone = HueTone | FixedTone;
type ThemedTone = Record<Theme, Tone>;

const same = (tone: Tone): ThemedTone => ({ light: tone, dark: tone });

/** Tonos de la receta. Los valores salen de la paleta aprobada (palette.md, «Rosa Mexicano»). */
export const TONES = {
  /** Texto, kicker y enlaces sobre `--card`, `--background`, `--secondary` o `soft`. */
  text: { light: { l: 0.52, c: 0.2 }, dark: { l: 0.82, c: 0.15 } },
  /** Fondo suave: selección y franjas de lectura. */
  soft: { light: { l: 0.965, c: 0.03 }, dark: { l: 0.21, c: 0.045 } },
  /**
   * Mosaico del emoji: un tinte suave, no un ícono saturado (ADR-042: el tono identifica a la
   * comunidad en pequeño; el color ya no es fondo). Sin texto encima.
   */
  tile: { light: { l: 0.93, c: 0.055, lift: 0.03 }, dark: { l: 0.3, c: 0.055, lift: 0.03 } },
  /** Barras, reglas e indicadores pequeños. Sin texto encima. */
  bar: { light: { l: 0.7, c: 0.13, lift: 0.14 }, dark: { l: 0.72, c: 0.13, lift: 0.06 } },
  /** Tinta profunda: titulares casi negros (casi blancos en oscuro), nunca cafés. */
  ink: { light: { l: 0.2, c: 0.035 }, dark: { l: 0.96, c: 0.02 } },
  /** Bloque con texto: un tinte apenas perceptible con tinta encima (ADR-042), en ambos temas. */
  block: { light: { l: 0.955, c: 0.035, lift: 0.02 }, dark: { l: 0.22, c: 0.04 } },
  blockText: { light: { fixed: [0.17, 0.01, 285] }, dark: { fixed: [0.97, 0.003, 285] } },
  blockMuted: { light: { fixed: [0.3, 0.02, 285] }, dark: { fixed: [0.78, 0.01, 285] } },
  /** Cartel: bloque de tinta con texto blanco y kicker claro. */
  poster: { light: { l: 0.19, c: 0.015 }, dark: { l: 0.22, c: 0.05 } },
  posterText: same({ fixed: [0.98, 0, 0] }),
  lite: same({ l: 0.84, c: 0.14 }),
  /** Avatar de persona sin foto (iniciales sobre su color). */
  avatar: { light: { l: 0.82, c: 0.13 }, dark: { l: 0.72, c: 0.14 } },
  avatarText: same({ l: 0.22, c: 0.07 }),
} satisfies Record<string, ThemedTone>;

export type ToneName = keyof typeof TONES;

type Declaration = { property: "color" | "background-color" | "border-color"; tone: ToneName };

/** API pública: utilidad de Tailwind → declaraciones. Documentada en docs/design/rediseno-revista.md. */
export const UTILITIES: Record<string, { description: string; declarations: Declaration[] }> = {
  "community-tile": {
    description: "Fondo saturado para el emoji de la comunidad (sin texto encima).",
    declarations: [{ property: "background-color", tone: "tile" }],
  },
  "community-text": {
    description: "Texto en el color de la comunidad; AA sobre card, background, secondary y soft.",
    declarations: [{ property: "color", tone: "text" }],
  },
  "community-ink": {
    description: "Tinta profunda con un toque del tono, para titulares.",
    declarations: [{ property: "color", tone: "ink" }],
  },
  "community-soft": {
    description: "Superficie suave con tinta profunda (selección, franjas).",
    declarations: [
      { property: "background-color", tone: "soft" },
      { property: "color", tone: "ink" },
    ],
  },
  "community-bar": {
    description: "Fondo vivo para barras, reglas e indicadores (sin texto encima).",
    declarations: [{ property: "background-color", tone: "bar" }],
  },
  "community-border": {
    description: "Borde en el color vivo de la comunidad (estado seleccionado).",
    declarations: [{ property: "border-color", tone: "bar" }],
  },
  "community-block": {
    description: "Bloque de color con texto: vivo con tinta negra en claro, profundo en oscuro.",
    declarations: [
      { property: "background-color", tone: "block" },
      { property: "color", tone: "blockText" },
    ],
  },
  "community-block-muted": {
    description: "Texto secundario dentro de community-block.",
    declarations: [{ property: "color", tone: "blockMuted" }],
  },
  "community-poster": {
    description: "Cartel: bloque de tinta con el tono y texto blanco.",
    declarations: [
      { property: "background-color", tone: "poster" },
      { property: "color", tone: "posterText" },
    ],
  },
  "community-lite": {
    description: "Kicker claro dentro de community-poster.",
    declarations: [{ property: "color", tone: "lite" }],
  },
  "avatar-tint": {
    description: "Avatar de persona sin foto: fondo y texto del tono en --hue.",
    declarations: [
      { property: "background-color", tone: "avatar" },
      { property: "color", tone: "avatarText" },
    ],
  },
};

/** Tono por omisión si nadie define `--hue`: el rosa mexicano de la marca. */
export const DEFAULT_HUE = 358.9;
const STEP = 15;
const SAFETY = 0.002;

const isFixed = (tone: Tone): tone is FixedTone => "fixed" in tone;
/**
 * 1 en h = 90, 0 fuera de 45–135. El coseno de 2·(h − 90) también vale 1 en h = 270, así que se
 * apaga desde 180 para no aclarar los azules y violetas (Gaming, 285).
 */
const lift = (hue: number) =>
  Math.max(0, Math.cos(((hue - 90) * 2 * Math.PI) / 180)) * Math.min(1, Math.max(0, 180 - hue));
const lightnessAt = (tone: HueTone, hue: number) => tone.l + (tone.lift ?? 0) * lift(hue);
const round = (value: number, digits: number) => Number(value.toFixed(digits));

/** f(h) = v0 + s0·h + Σ dᵢ·max(0, h − xᵢ), con dᵢ = sᵢ − sᵢ₋₁ (cambio de pendiente en xᵢ). */
type ChromaCap = { v0: number; s0: number; hinges: Array<{ x: number; d: number }> };

const capCache = new Map<string, ChromaCap | null>();

/**
 * Tope de croma lineal por tramos (vértices cada 15°) que nunca sale de sRGB en ningún tono.
 * Devuelve `null` si el croma del tono cabe completo en todos los tonos.
 */
function chromaCap(tone: HueTone): ChromaCap | null {
  const key = JSON.stringify(tone);
  if (capCache.has(key)) return capCache.get(key)!;
  const limit = (hue: number) => maxSrgbChroma(lightnessAt(tone, hue), hue % 360);
  const xs = Array.from({ length: 360 / STEP + 1 }, (_, i) => i * STEP);
  if (xs.every((_, i) => i === 0 || fineGrid(xs[i - 1]!).every((h) => limit(h) >= tone.c))) {
    capCache.set(key, null);
    return null;
  }
  const values = xs.map((x) => Math.min(tone.c, limit(x) - SAFETY));
  // Baja los vértices hasta que ningún punto del tramo quede fuera de la gama.
  for (let pass = 0; pass < 60; pass += 1) {
    let changed = false;
    for (let i = 0; i < xs.length - 1; i += 1) {
      let worst = 0;
      for (const h of fineGrid(xs[i]!)) {
        const t = (h - xs[i]!) / STEP;
        const value = values[i]! * (1 - t) + values[i + 1]! * t;
        worst = Math.max(worst, value - (limit(h) - SAFETY));
      }
      if (worst > 0) {
        values[i] = values[i]! - worst;
        values[i + 1] = values[i + 1]! - worst;
        changed = true;
      }
    }
    const wrap = Math.min(values[0]!, values.at(-1)!);
    values[0] = wrap;
    values[values.length - 1] = wrap;
    if (!changed) break;
  }
  const slopes = values.slice(0, -1).map((v, i) => (values[i + 1]! - v) / STEP);
  const cap: ChromaCap = {
    v0: round(values[0]!, 5),
    s0: round(slopes[0]!, 7),
    hinges: slopes
      .slice(1)
      .map((s, i) => ({ x: xs[i + 1]!, d: round(s - slopes[i]!, 7) }))
      .filter((hinge) => hinge.d !== 0),
  };
  capCache.set(key, cap);
  return cap;
}

function fineGrid(start: number) {
  return Array.from({ length: STEP * 4 + 1 }, (_, i) => start + i / 4);
}

function evaluateCap(cap: ChromaCap, hue: number) {
  return cap.hinges.reduce(
    (sum, { x, d }) => sum + d * Math.max(0, hue - x),
    cap.v0 + cap.s0 * hue,
  );
}

/** Color que pinta el navegador para un tono y un tema (misma cuenta que el CSS generado). */
export function toneColor(name: ToneName, theme: Theme, hue: number): Oklch {
  const tone: Tone = TONES[name][theme];
  if (isFixed(tone)) return tone.fixed;
  const cap = chromaCap(tone);
  const chroma = cap ? Math.min(tone.c, evaluateCap(cap, hue)) : tone.c;
  return [lightnessAt(tone, hue), chroma, hue];
}

// ---------------------------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------------------------

const H = "var(--_h)";

/** Declaraciones CSS de un tono: el tope de croma va en una variable local para que se lea. */
function toneDeclarations(property: string, toneName: ToneName, theme: Theme) {
  const tone: Tone = TONES[toneName][theme];
  if (isFixed(tone)) return [`${property}: oklch(${tone.fixed.join(" ")});`];
  const lightness = tone.lift ? `calc(${tone.l} + ${tone.lift} * var(--_lift))` : `${tone.l}`;
  const cap = chromaCap(tone);
  if (!cap) return [`${property}: oklch(${lightness} ${tone.c} ${H});`];
  const variable = `--_c-${toneName}`;
  const sign = (value: number) => (value < 0 ? "-" : "+");
  const terms = [
    ...(cap.s0 === 0 ? [] : [`${sign(cap.s0)} ${Math.abs(cap.s0)} * ${H}`]),
    ...cap.hinges.map(({ x, d }) => `${sign(d)} ${Math.abs(d)} * max(0, ${H} - ${x})`),
  ];
  return [
    `${variable}: calc(`,
    `  ${cap.v0}`,
    ...terms.map((term) => `  ${term}`),
    ");",
    `${property}: oklch(${lightness} min(${tone.c}, var(${variable})) ${H});`,
  ];
}

function needsLift(declarations: Declaration[]) {
  return declarations.some(({ tone }) =>
    (["light", "dark"] as const).some((theme) => {
      const value: Tone = TONES[tone][theme];
      return !isFixed(value) && Boolean(value.lift);
    }),
  );
}

export function renderCommunityTintCss() {
  const blocks = Object.entries(UTILITIES).map(([name, { description, declarations }]) => {
    const body = (theme: Theme, indent: string) =>
      declarations
        .flatMap(({ property, tone }) => toneDeclarations(property, tone, theme))
        .map((line) => `${indent}${line}`);
    return [
      `/* ${description} */`,
      `@utility ${name} {`,
      `  --_h: var(--hue, ${DEFAULT_HUE});`,
      ...(needsLift(declarations)
        ? [
            "  --_lift: calc(max(0, cos(calc((var(--_h) - 90) * 2deg))) * clamp(0, 180 - var(--_h), 1));",
          ]
        : []),
      ...body("light", "  "),
      "  &:is(.dark *) {",
      ...body("dark", "    "),
      "  }",
      "}",
    ].join("\n");
  });
  return `${[HEADER, ...blocks].join("\n\n")}\n`;
}

const HEADER = `/*
 * GENERADO por \`pnpm tint\` desde src/styles/community-tint.ts. No lo edites a mano.
 *
 * Utilidades de color por comunidad: leen \`--hue\` (0–359) del elemento o de un ancestro.
 * El croma se limita tono por tono para no salir de sRGB (así el contraste AA se cumple en
 * cualquier pantalla) y --lift aclara los amarillos y verdes oliva.
 */`;
