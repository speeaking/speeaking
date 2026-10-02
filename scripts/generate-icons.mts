/**
 * Genera los íconos a partir de public/brand/mark.svg (ADR-070). Uso: pnpm icons (vuelve a
 * ejecutarlo si cambia la marca).
 *
 * - PWA (`public/icons`, los nombra `manifest.ts`): sobre el navy de la marca.
 * - Pestaña y pantalla de inicio de iPhone: `src/app/favicon.ico` y `src/app/apple-icon.png`, que
 *   Next anuncia solo en el `<head>` junto con `src/app/icon.svg` (convención de archivos).
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const BACKGROUND = "#10152f";
const source = await readFile(new URL("../public/brand/mark.svg", import.meta.url));

const output = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));

async function render(size: number, path: string, padding: number) {
  const inner = Math.round(size * (1 - padding * 2));
  const mark = await sharp(source, { density: 512 }).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(output(path));
  console.warn(`✓ ${path}`);
}

/**
 * `favicon.ico` para quien lo pide directo (lectores, buscadores, navegadores viejos): el isotipo
 * de 32 px sin fondo, como PNG dentro de un contenedor ICO (lo leen todos los navegadores actuales).
 */
async function favicon(path: string) {
  const png = await sharp(source, { density: 512 }).resize(32, 32).png().toBuffer();
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
  await writeFile(output(path), Buffer.concat([header, entry, png]));
  console.warn(`✓ ${path}`);
}

await render(192, "public/icons/icon-192.png", 0.12);
await render(512, "public/icons/icon-512.png", 0.12);
// "maskable": el sistema recorta hasta un 20 % por lado, así que dejamos más margen.
await render(512, "public/icons/icon-maskable-512.png", 0.22);
await render(180, "src/app/apple-icon.png", 0.14);
await favicon("src/app/favicon.ico");
