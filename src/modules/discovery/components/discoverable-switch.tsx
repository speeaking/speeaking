"use client";

import { useId, useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

/**
 * Ajuste de privacidad «Aparecer en sugerencias». Recibe la acción del servidor desde la página
 * (vive en identity/privacy-actions) y se actualiza al instante; si falla, vuelve atrás.
 */
export function DiscoverableSwitch({
  initialEnabled,
  action,
}: {
  initialEnabled: boolean;
  action: (enabled: boolean) => Promise<void>;
}) {
  const id = useId();
  const descriptionId = `${id}-descripcion`;
  const [enabled, setOptimisticEnabled] = useOptimistic(initialEnabled);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1 text-sm">
        <label htmlFor={id} className="font-semibold">
          Aparecer en sugerencias de «Gente de tus comunidades»
        </label>
        <p id={descriptionId} className="text-muted-foreground">
          {enabled
            ? "Otras personas pueden verte como sugerencia si comparten comunidades contigo, si alguien a quien siguen te sigue o si comentaste lo que publican."
            : "No apareces como sugerencia para nadie. Tu perfil sigue siendo público y te pueden seguir."}
        </p>
      </div>
      <Switch
        id={id}
        aria-describedby={descriptionId}
        // En móvil el área táctil llega a 44 px de alto (el interruptor mide 18 px).
        className="mt-1 after:-inset-y-3.5"
        checked={enabled}
        disabled={pending}
        onCheckedChange={(checked) =>
          startTransition(async () => {
            setOptimisticEnabled(checked);
            try {
              await action(checked);
            } catch {
              toast.error("No pudimos guardar el cambio. Intenta de nuevo.");
            }
          })
        }
      />
    </div>
  );
}
