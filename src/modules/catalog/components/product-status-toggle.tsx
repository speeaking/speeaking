"use client";

import { Pause, Play } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleProductStatusAction } from "../actions";
import type { ToggleTarget } from "../status";

const DONE_MESSAGES = {
  PAUSED: "Pausaste tu producto: nadie puede comprarlo hasta que lo reactives.",
  ACTIVE: "Tu producto está otra vez a la venta.",
  SOLD_OUT: "Lo reactivaste, pero no tiene piezas: edita el inventario para venderlo.",
} as const;

/** "Pausar" o "Reactivar" un producto propio desde el Studio (el servidor comprueba el dueño). */
export function ProductStatusToggle({
  productId,
  title,
  target,
}: {
  productId: string;
  title: string;
  target: ToggleTarget;
}) {
  const [pending, startTransition] = useTransition();
  const pausing = target === "PAUSED";

  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 px-4"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await toggleProductStatusAction(productId, target);
          if (result.ok) toast.success(DONE_MESSAGES[result.status]);
          else toast.error(result.error);
        })
      }
    >
      {pausing ? <Pause data-icon="inline-start" /> : <Play data-icon="inline-start" />}
      {pausing ? "Pausar" : "Reactivar"}
      <span className="sr-only"> {title}</span>
    </Button>
  );
}
