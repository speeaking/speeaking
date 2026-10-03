import { APPLE_STARTUP_IMAGES } from "@/config/app-brand";

/** Safari usa estos recursos al abrir la app desde la pantalla de inicio. */
export function AppStartupImages() {
  return APPLE_STARTUP_IMAGES.map(({ url, media }) => (
    <link key={media} rel="apple-touch-startup-image" href={url} media={media} />
  ));
}
