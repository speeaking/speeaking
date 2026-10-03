/**
 * Genera los iconos y las pantallas de apertura desde la imagen original de la marca.
 * Uso: pnpm icons. Las caras se conservan completas y el icono adaptable deja un margen seguro.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import type * as AppBrand from "../src/config/app-brand";
const { APPLE_STARTUP_SCREENS, APP_LAUNCH_BACKGROUND } = (await import(
  new URL("../src/config/app-brand.ts", import.meta.url).href
)) as typeof AppBrand;

const source = await readFile(new URL("../public/brand/launch-source.png", import.meta.url));
const output = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));

await mkdir(output("public/icons"), { recursive: true });
// Quita solamente el espacio exterior del original horizontal; las dos figuras quedan completas.
const cropped = await sharp(source)
  .extract({ left: 369, top: 79, width: 960, height: 768 })
  .png()
  .toBuffer();
// Fundir solo el borde exterior con el fondo evita un rectángulo alrededor del logo al abrir.
const edgeMask = Buffer.from(`
  <svg width="960" height="768" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="x">
        <stop offset="0" stop-color="white" stop-opacity="0"/>
        <stop offset="0.08" stop-color="white"/>
        <stop offset="0.92" stop-color="white"/>
        <stop offset="1" stop-color="white" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="y" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="white" stop-opacity="0"/>
        <stop offset="0.08" stop-color="white"/>
        <stop offset="0.92" stop-color="white"/>
        <stop offset="1" stop-color="white" stop-opacity="0"/>
      </linearGradient>
      <mask id="vertical"><rect width="960" height="768" fill="url(#y)"/></mask>
    </defs>
    <rect width="960" height="768" fill="url(#x)" mask="url(#vertical)"/>
  </svg>`);
const mark = await sharp(cropped)
  .composite([{ input: edgeMask, blend: "dest-in" }])
  .png()
  .toBuffer();
await sharp(mark).webp({ quality: 90 }).toFile(output("public/brand/launch-logo.webp"));

async function render(size: number, path: string, padding: number) {
  const inner = Math.round(size * (1 - padding * 2));
  const logo = await sharp(mark).resize(inner, inner, { fit: "inside" }).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: APP_LAUNCH_BACKGROUND },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(output(path));
}

/**
 * PNG de 32 px dentro de un contenedor ICO para navegadores y lectores que lo piden directamente.
 */
async function favicon() {
  const png = await sharp(mark)
    .resize(32, 32, { fit: "contain", background: APP_LAUNCH_BACKGROUND })
    .png()
    .toBuffer();
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // tipo: ícono
  header.writeUInt16LE(1, 4); // una imagen
  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0); // ancho
  entry.writeUInt8(32, 1); // alto
  entry.writeUInt16LE(1, 4); // planos de color
  entry.writeUInt16LE(32, 6); // bits por pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12); // dónde empieza la imagen
  await writeFile(output("src/app/favicon.ico"), Buffer.concat([header, entry, png]));
}

async function startup(width: number, height: number, scale: number) {
  const logoWidth = Math.round(Math.min(width * 0.82, 384 * scale));
  const logo = await sharp(mark).resize({ width: logoWidth }).png().toBuffer();
  await sharp({
    create: { width, height, channels: 4, background: APP_LAUNCH_BACKGROUND },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png({ palette: true, colours: 256, dither: 1, effort: 2 })
    .toFile(output(`public/icons/startup-${width}x${height}.png`));
}

await render(192, "public/icons/icon-192.png", 0.03);
await render(512, "public/icons/icon-512.png", 0.03);
// Las dos caras quedan dentro de la zona segura circular del icono adaptable.
await render(512, "public/icons/icon-maskable-512.png", 0.16);
await render(180, "src/app/apple-icon.png", 0.03);
await render(64, "src/app/icon.png", 0.03);
await favicon();
for (let index = 0; index < APPLE_STARTUP_SCREENS.length; index += 2) {
  await Promise.all(
    APPLE_STARTUP_SCREENS.slice(index, index + 2).flatMap(([width, height, scale]) => [
      startup(width * scale, height * scale, scale),
      startup(height * scale, width * scale, scale),
    ]),
  );
}
console.warn("Iconos y pantallas de apertura generados con el logo original.");
