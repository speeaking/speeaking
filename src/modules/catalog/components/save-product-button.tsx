"use client";

import { Bookmark } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleSaveAction } from "@/modules/social/actions";

export function SaveProductButton({
  productId,
  initialSaved,
}: {
  productId: string;
  initialSaved: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [saved, setSaved] = useOptimistic(initialSaved);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-pressed={saved}
      aria-label={saved ? "Quitar de guardados" : "Guardar producto"}
      onClick={() =>
        startTransition(async () => {
          setSaved(!saved);
          const result = await toggleSaveAction({ productId }, "PRODUCT_PAGE");
          if (!result.ok && result.needsAuth) {
            router.push(`/entrar?next=${encodeURIComponent(window.location.pathname)}` as Route);
          } else if (!result.ok) {
            toast.error(result.error);
          }
        })
      }
    >
      <Bookmark className={saved ? "fill-current" : undefined} />
    </Button>
  );
}
