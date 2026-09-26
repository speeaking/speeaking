import type { AdKitView } from "../ad-kit/service";
import { aiAvailability } from "../tasks/availability";
import type { AiAvailability } from "../tasks/simulation";
import { AdKitPanel } from "./ad-kit-panel";

/**
 * Kit de anuncios (Studio → Contenido). Componente de servidor: decide si la IA es de verdad,
 * simulada (piloto) o no está disponible (ADR-038, `tasks/simulation.ts`) y lo pasa al panel. La
 * página que ya lo calculó para sus textos lo pasa en `availability`.
 */
export async function AdKit({
  initial,
  availability,
}: {
  initial: AdKitView;
  availability?: AiAvailability;
}) {
  return (
    <AdKitPanel
      initial={initial}
      availability={availability ?? (await aiAvailability("ad_copy"))}
    />
  );
}
