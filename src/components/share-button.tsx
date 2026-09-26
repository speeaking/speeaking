"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Compartir afuera (P1): usa el menú nativo del teléfono (WhatsApp, Instagram…) o copia el
 * enlace. `path` se completa con el dominio actual y `ref=compartir` para atribuir la visita.
 */
export function ShareButton({
  path,
  title,
  text,
  label = "Compartir",
  variant = "outline",
  onShared,
}: {
  path: string;
  title: string;
  text?: string;
  label?: string;
  variant?: "outline" | "default" | "secondary";
  onShared?: (channel: "native" | "copy") => void;
}) {
  const share = async () => {
    const url = new URL(path, window.location.origin);
    url.searchParams.set("ref", "compartir");
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: url.toString() });
        onShared?.("native");
      } else {
        await navigator.clipboard.writeText(url.toString());
        toast.success("Enlace copiado. Pégalo en WhatsApp o donde quieras.");
        onShared?.("copy");
      }
    } catch {
      // Cancelado por la persona.
    }
  };

  return (
    <Button type="button" variant={variant} onClick={share}>
      <Share2 data-icon="inline-start" />
      {label}
    </Button>
  );
}
