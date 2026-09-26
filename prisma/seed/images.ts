/**
 * Carteles ilustrativos para el contenido semilla. Son gráficos editoriales (degradado + título),
 * no fotos: no simulan contenido de personas reales.
 */

function escapeXml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Parte el texto en líneas de como máximo `maxChars` caracteres, sin cortar palabras. */
export function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function posterSvg({
  title,
  kicker,
  footer,
  hue,
}: {
  title: string;
  kicker: string;
  footer?: string;
  hue: number;
}): Buffer {
  const width = 1080;
  const height = 1350;
  const lines = wrapText(title, 16);
  const lineHeight = 108;
  const titleTop = height - 260 - (lines.length - 1) * lineHeight;
  const font = "Segoe UI, Helvetica, Arial, sans-serif";

  const titleLines = lines
    .map(
      (line, index) =>
        `<text x="80" y="${titleTop + index * lineHeight}" font-family="${font}" font-size="96" font-weight="800" fill="#fff">${escapeXml(line)}</text>`,
    )
    .join("");

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue} 72% 46%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 40) % 360} 80% 55%)"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <circle cx="900" cy="200" r="280" fill="#fff" fill-opacity=".12"/>
  <circle cx="120" cy="520" r="140" fill="#fff" fill-opacity=".08"/>
  <text x="80" y="140" font-family="${font}" font-size="40" font-weight="700" fill="#fff" fill-opacity=".9" letter-spacing="4">${escapeXml(kicker.toUpperCase())}</text>
  ${titleLines}
  ${footer ? `<text x="80" y="${height - 120}" font-family="${font}" font-size="48" font-weight="600" fill="#fff" fill-opacity=".92">${escapeXml(footer)}</text>` : ""}
</svg>`);
}
