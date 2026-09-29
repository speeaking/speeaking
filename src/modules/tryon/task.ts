import sharp from "sharp";
import type { OutfitSlot } from "@/modules/stylist/slots";
import { SLOT_LABELS } from "@/modules/stylist/slots";
import type { ImageInput, ImageTask } from "@/server/providers/image/types";

/**
 * Tarea de imagen «Pruébatelo» (ADR-043, ADR-045). El prompt no lleva datos personales: solo la foto,
 * las fotos de los productos y sus nombres. El simulador compone la foto con miniaturas de las
 * prendas y una franja que dice que es un ejemplo: sirve para desarrollo, pruebas y el piloto sin
 * modelo de imagen.
 */
export type TryOnGarment = { image: ImageInput; title: string; slot: OutfitSlot };

export type TryOnInput = { person: ImageInput; garments: TryOnGarment[] };

export const TRY_ON_PROMPT_VERSION = "tryon@1";

import { MAX_TRY_ON_GARMENTS } from "./limits";

export { MAX_TRY_ON_GARMENTS } from "./limits";

/** Lado mayor del resultado (el simulador y lo que se le pide al modelo). */
const RESULT_MAX_SIDE = 1024;
/** Lado menor mínimo del lienzo del simulador: una foto diminuta se rellena, no se estira. */
const MOCK_MIN_SIDE = 320;
const MOCK_LABEL = "Simulación de ejemplo (IA simulada)";

function garmentLine(garment: TryOnGarment, index: number) {
  return `Image ${index + 2}: ${SLOT_LABELS[garment.slot]} — "${garment.title.slice(0, 80)}"`;
}

/** Instrucciones en inglés (los modelos de imagen las siguen mejor); nunca nombres ni usuarios. */
export function tryOnInstructions(garments: TryOnGarment[]) {
  return [
    "Virtual try-on. Image 1 shows a person. Dress this exact same person in the garments shown in the following images:",
    ...garments.map(garmentLine),
    "Keep the person's face, identity, hair, skin tone, body proportions, pose and the background exactly as in image 1.",
    "Replace only the corresponding clothing or accessories; keep everything else unchanged.",
    "Photorealistic result with natural lighting, realistic fabric drape and correct fit. Output a single image of the same framing as image 1.",
    "Do not add text, logos or watermarks.",
  ].join("\n");
}

export const tryOnTask: ImageTask<TryOnInput> = {
  task: "virtual_try_on",
  promptVersion: TRY_ON_PROMPT_VERSION,
  prompt(input) {
    const garments = input.garments.slice(0, MAX_TRY_ON_GARMENTS);
    return {
      instructions: tryOnInstructions(garments),
      images: [input.person, ...garments.map((garment) => garment.image)],
    };
  },
  async mock(input) {
    const fitted = await sharp(input.person.data)
      .rotate()
      .resize({
        width: RESULT_MAX_SIDE,
        height: RESULT_MAX_SIDE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toBuffer();
    const fittedMeta = await sharp(fitted).metadata();
    // Un lienzo demasiado chico no cabe las miniaturas ni la franja: se rellena con fondo neutro.
    const padX = Math.max(0, MOCK_MIN_SIDE - (fittedMeta.width ?? 0));
    const padY = Math.max(0, MOCK_MIN_SIDE - (fittedMeta.height ?? 0));
    const person =
      padX > 0 || padY > 0
        ? await sharp(fitted)
            .extend({
              top: Math.floor(padY / 2),
              bottom: Math.ceil(padY / 2),
              left: Math.floor(padX / 2),
              right: Math.ceil(padX / 2),
              background: "#e9e6e1",
            })
            .toBuffer()
        : fitted;
    const meta = await sharp(person).metadata();
    const width = meta.width ?? RESULT_MAX_SIDE;
    const height = meta.height ?? RESULT_MAX_SIDE;
    const thumb = Math.max(64, Math.round(Math.min(width, height) * 0.22));
    const margin = 12;
    const garments = input.garments.slice(0, MAX_TRY_ON_GARMENTS);
    const overlays = await Promise.all(
      garments.map(async (garment, index) => ({
        input: await sharp(garment.image.data)
          .rotate()
          .resize(thumb, thumb, { fit: "cover" })
          .extend({ top: 4, bottom: 4, left: 4, right: 4, background: "#ffffff" })
          .png()
          .toBuffer(),
        left: Math.max(0, width - thumb - 8 - margin),
        top: margin + index * (thumb + 8 + 8),
      })),
    );
    const bandHeight = Math.max(40, Math.round(height * 0.05));
    const band = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${bandHeight}">` +
        `<rect width="100%" height="100%" fill="rgba(15,15,20,0.72)"/>` +
        `<text x="${margin}" y="${Math.round(bandHeight * 0.66)}" font-family="sans-serif" font-size="${Math.round(bandHeight * 0.42)}" fill="#ffffff">${MOCK_LABEL}</text>` +
        `</svg>`,
    );
    const data = await sharp(person)
      .composite([
        ...overlays.filter((overlay) => overlay.top + thumb <= height - bandHeight),
        { input: band, left: 0, top: height - bandHeight },
      ])
      .webp({ quality: 82 })
      .toBuffer();
    return { data, mimeType: "image/webp" };
  },
};
