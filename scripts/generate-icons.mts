/**
 * Genera los íconos PNG de la PWA a partir de public/brand/mark.svg.
 * Uso: pnpm icons (vuelve a ejecutarlo si cambia la marca).
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const BACKGROUND = "#ffffff";
const source = await readFile(new URL("../public/brand/mark.svg", import.meta.url));

async function render(size: number, file: string, padding: number) {
  const inner = Math.round(size * (1 - padding * 2));
  const mark = await sharp(source, { density: 512 }).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(fileURLToPath(new URL(`../public/icons/${file}`, import.meta.url)));
  console.warn(`✓ ${file}`);
}

await render(192, "icon-192.png", 0.12);
await render(512, "icon-512.png", 0.12);
// "maskable": el sistema recorta hasta un 20 % por lado, así que dejamos más margen.
await render(512, "icon-maskable-512.png", 0.22);
await render(180, "apple-touch-icon.png", 0.14);
