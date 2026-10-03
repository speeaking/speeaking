import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";

/*
 * Imagen para compartir del sitio (WhatsApp, Facebook, X) en las páginas sin foto propia; /p y
 * /producto ponen la suya. Se genera en el build sin red: usa la fuente que trae `next/og` (Geist),
 * porque Sora no está en node_modules, y las caras del logotipo van en SVG.
 */

export const alt = `${siteConfig.name}: ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Colores fijos de la marca (ADR-070, `brand-*` en globals.css).
const NAVY = "#10152F";
const VIOLET = "#8B3DFF";
const CYAN = "#00CFE8";

function svg(markup: string) {
  return `data:image/svg+xml;base64,${Buffer.from(markup).toString("base64")}`;
}

/** Las dos caras del logotipo, las «ee» (`BrandFaces` en components/brand). */
const FACES = svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 58 34">
  <g fill="${VIOLET}" stroke="${VIOLET}" stroke-width="1.2" stroke-linejoin="round">
    <circle cx="14" cy="15" r="13"/><path d="M3.4 22.5 2 32.5l8.2-5.7z"/>
  </g>
  <g fill="#fff">
    <ellipse cx="9.8" cy="12.6" rx="1.7" ry="2.3"/><ellipse cx="17.2" cy="12.6" rx="1.7" ry="2.3"/>
    <path d="M9.4 17.6h8.2a4.1 4.1 0 0 1-8.2 0z"/>
  </g>
  <g fill="${CYAN}" stroke="${CYAN}" stroke-width="1.2" stroke-linejoin="round">
    <circle cx="43" cy="17" r="13"/><path d="M53.6 24.5 56 33.5l-9.2-4.3z"/>
  </g>
  <g fill="${NAVY}">
    <ellipse cx="39.2" cy="15.6" rx="1.7" ry="2.3"/><ellipse cx="46.8" cy="15.6" rx="1.7" ry="2.3"/>
  </g>
  <path d="M40 21.6h6" stroke="${NAVY}" stroke-width="1.8" stroke-linecap="round"/>
</svg>`);

const WORDMARK_SIZE = 168;
const FACES_HEIGHT = Math.round(WORDMARK_SIZE * 0.74);

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: NAVY,
        backgroundImage: `radial-gradient(circle at 88% 12%, ${VIOLET}55, ${NAVY}00 46%)`,
        color: "#fff",
      }}
    >
      {/* «sp» + las caras + «aking», como el logotipo (`Wordmark`). */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: WORDMARK_SIZE,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          // Geist solo trae el peso regular: el trazo lo acerca al seminegro del logotipo.
          WebkitTextStroke: "3px #fff",
        }}
      >
        <span>sp</span>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse no usa next/image */}
        <img
          src={FACES}
          alt=""
          height={FACES_HEIGHT}
          width={Math.round((FACES_HEIGHT * 58) / 34)}
          style={{ margin: "0 4px", transform: "translateY(12px)" }}
        />
        <span>aking</span>
      </div>
      <div
        style={{
          display: "flex",
          gap: 14,
          marginTop: 44,
          fontSize: 52,
          color: "rgba(255, 255, 255, 0.84)",
        }}
      >
        {/* Letra por letra: Satori mide algunas palabras más anchas de lo que las dibuja (pares
            con kerning como «rs» o «ra») y tras «conversaciones» o «cobran» quedaba un hueco doble. */}
        {siteConfig.tagline.split(" ").map((word, index) => (
          <div key={index} style={{ display: "flex" }}>
            {[...word].map((letter, position) => (
              <span key={position}>{letter}</span>
            ))}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 56, width: 136, height: 12, borderRadius: 6, background: VIOLET }} />
    </div>,
    size,
  );
}
