import type { AutonomyMode } from "@/modules/platform/autonomy";
import { setAutonomyAction } from "../actions";
import { ConfirmAction } from "./confirm-action";

/**
 * Interruptor del modo de autonomía (observador ↔ riesgo bajo) con diálogo de confirmación. El cambio
 * lo hace el servicio y queda en la bitácora de decisiones como acción del equipo.
 */
export function AutonomyToggle({
  mode,
  thresholdMet,
  thresholdReason,
}: {
  mode: AutonomyMode;
  thresholdMet: boolean;
  thresholdReason: string;
}) {
  if (mode === "observer") {
    return (
      <ConfirmAction
        action={setAutonomyAction}
        fields={{ mode: "low_risk" }}
        triggerLabel="Activar riesgo bajo"
        triggerVariant="default"
        title="¿Activar el modo riesgo bajo?"
        description="Lo de riesgo bajo (pesos del feed dentro de sus límites) se aplicará solo, con reversión automática si una salvaguarda se rompe. Lo de riesgo medio se probará con el 10 % de las personas y adoptarlo seguirá requiriendo tu aprobación. Lo de riesgo alto nunca se aplica solo."
        confirmLabel="Activar riesgo bajo"
      >
        <p
          className={
            thresholdMet
              ? "rounded-xl bg-success/10 px-3 py-2 text-sm text-success"
              : "rounded-xl bg-secondary px-3 py-2 text-sm"
          }
        >
          {thresholdMet
            ? thresholdReason
            : `${thresholdReason} Mientras no se cumpla, nada se aplicará solo aunque actives este modo.`}
        </p>
      </ConfirmAction>
    );
  }
  return (
    <ConfirmAction
      action={setAutonomyAction}
      fields={{ mode: "observer" }}
      triggerLabel="Volver a observador"
      title="¿Volver al modo observador?"
      description="La IA solo propondrá; nada se aplicará ni se probará sin tu aprobación. Los experimentos en curso siguen hasta que los detengas, y las salvaguardas siguen revirtiendo lo que empeore."
      confirmLabel="Volver a observador"
    />
  );
}
