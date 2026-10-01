import { ProfileSkeleton } from "@/components/states/profile-skeleton";
import { PAGE_SHEET_ENTER } from "@/lib/page-turn";
import { ViewTransition } from "@/lib/view-transition";

/**
 * Esqueleto del perfil (ADR-055). Va envuelto en un límite de transición: con el tipo «perfil» es lo
 * que hace que React inicie la transición de vista y la página actual «se despegue» (globals.css);
 * el esqueleto en sí no se anima, solo espera debajo hasta que llega la ficha.
 */
export default function Loading() {
  return (
    <ViewTransition enter={PAGE_SHEET_ENTER} default="none">
      <ProfileSkeleton />
    </ViewTransition>
  );
}
