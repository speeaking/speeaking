"use client";

import { Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { declareGenericAction } from "../actions";

/** Cambia la declaración del producto a «genérico o compatible» (deja de decir que es original). */
export function DeclareGenericButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 self-start px-4"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await declareGenericAction(productId);
          if (result.ok) {
            toast.success("Listo: tu producto ahora dice «genérico o compatible».");
            router.refresh();
          } else {
            toast.error(result.error);
          }
        })
      }
    >
      <Tag data-icon="inline-start" />
      Marcar como genérico o compatible
    </Button>
  );
}
