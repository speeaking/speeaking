/**
 * Descarga las fotos de stock del manifiesto (`prisma/seed/photos.ts`), las recorta al formato
 * con que se muestran (4:5 publicaciones, 1:1 productos) y las guarda en `prisma/seed/photos/`.
 * Uso: `pnpm seed:photos` (omite las que ya existen; `--force` las vuelve a generar).
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { photoFileName, seedPhotos, type SeedPhoto } from "../prisma/seed/photos";

const OUT_DIR = path.join("prisma", "seed", "photos");
const POST_SIZE = { width: 1080, height: 1350 };
const PRODUCT_SIZE = { width: 1200, height: 1200 };
const CONTAIN_BACKGROUND = { r: 242, g: 239, b: 236, alpha: 1 };
const force = process.argv.includes("--force");

/** Recorte del tamaño de destino que respeta el punto de interés sin salirse de la imagen. */
function cropBox(
  source: { width: number; height: number },
  target: { width: number; height: number },
  focus: { x: number; y: number },
) {
  const scale = Math.max(target.width / source.width, target.height / source.height);
  const width = Math.round(target.width / scale);
  const height = Math.round(target.height / scale);
  const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
  return {
    left: clamp(Math.round(focus.x * source.width - width / 2), source.width - width),
    top: clamp(Math.round(focus.y * source.height - height / 2), source.height - height),
    width,
    height,
  };
}

/** Color promedio de las esquinas: el fondo del estudio, para que el encuadre no se note. */
async function cornerColor(input: Buffer) {
  const { data, info } = await sharp(input)
    .resize(64, 64, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const total = [0, 0, 0];
  let count = 0;
  for (const [x0, y0] of [
    [0, 0],
    [56, 0],
    [0, 56],
    [56, 56],
  ] as const) {
    for (let y = y0; y < y0 + 8; y += 1) {
      for (let x = x0; x < x0 + 8; x += 1) {
        const offset = (y * info.width + x) * info.channels;
        for (let channel = 0; channel < 3; channel += 1) {
          total[channel]! += data[offset + channel]!;
        }
        count += 1;
      }
    }
  }
  const [r = 0, g = 0, b = 0] = total.map((sum) => Math.round(sum / count));
  return { r, g, b, alpha: 1 };
}

async function render(photo: SeedPhoto, input: Buffer, target: { width: number; height: number }) {
  const image = sharp(input).rotate();
  if (photo.fit === "contain") {
    const background = await cornerColor(input).catch(() => CONTAIN_BACKGROUND);
    const padding = Math.round(target.width * 0.06);
    const inner = await image
      .resize(target.width - padding * 2, target.height - padding * 2, {
        fit: "contain",
        background,
      })
      .toBuffer();
    return sharp({
      create: { ...target, channels: 4, background },
    })
      .composite([{ input: inner }])
      .webp({ quality: 84 })
      .toBuffer();
  }
  const { width = 0, height = 0 } = await image.metadata();
  const box = cropBox({ width, height }, target, photo.focus ?? { x: 0.5, y: 0.5 });
  return image.extract(box).resize(target).webp({ quality: 84 }).toBuffer();
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  let written = 0;
  for (const [key, photo] of Object.entries(seedPhotos)) {
    const file = path.join(OUT_DIR, photoFileName(key));
    if (existsSync(file) && !force) continue;

    const response = await fetch(photo.imageUrl, { headers: { "User-Agent": "VendeIA-seed/1.0" } });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.startsWith("image/")) {
      throw new Error(`No se pudo descargar ${key}: ${response.status} ${type}`);
    }
    const input = Buffer.from(await response.arrayBuffer());
    const target = key.startsWith("product:") ? PRODUCT_SIZE : POST_SIZE;
    writeFileSync(file, await render(photo, input, target));
    written += 1;
    console.warn(`✓ ${key}`);
  }
  console.warn(`✓ ${written} fotos nuevas en ${OUT_DIR}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
