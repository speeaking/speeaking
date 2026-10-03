/** Recursos de apertura derivados de la imagen original de la marca. */
export const APP_LAUNCH_BACKGROUND = "#030911";
export const APP_ICON_VERSION = "neon-20261003";

// Ancho y alto de pantalla en puntos CSS, seguidos de su escala de píxeles.
// Safari necesita una imagen con las dimensiones físicas de cada pantalla.
export const APPLE_STARTUP_SCREENS = [
  [320, 568, 2],
  [375, 667, 2],
  [414, 736, 3],
  [375, 812, 3],
  [390, 844, 3],
  [393, 852, 3],
  [402, 874, 3],
  [414, 896, 2],
  [414, 896, 3],
  [420, 912, 3],
  [428, 926, 3],
  [430, 932, 3],
  [440, 956, 3],
  [744, 1133, 2],
  [768, 1024, 2],
  [810, 1080, 2],
  [820, 1180, 2],
  [834, 1112, 2],
  [834, 1194, 2],
  [834, 1210, 2],
  [1024, 1366, 2],
  [1032, 1376, 2],
] as const;

export const APPLE_STARTUP_IMAGES = APPLE_STARTUP_SCREENS.flatMap(([width, height, scale]) =>
  (["portrait", "landscape"] as const).map((orientation) => {
    const pixelWidth = (orientation === "portrait" ? width : height) * scale;
    const pixelHeight = (orientation === "portrait" ? height : width) * scale;
    return {
      url: `/icons/startup-${pixelWidth}x${pixelHeight}.png`,
      media:
        `(device-width: ${width}px) and (device-height: ${height}px) ` +
        `and (-webkit-device-pixel-ratio: ${scale}) and (orientation: ${orientation})`,
    };
  }),
);
