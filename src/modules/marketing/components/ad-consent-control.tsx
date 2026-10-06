"use client";

import { Button } from "@/components/ui/button";
import { saveAdConsent } from "../tiktok";
import { useAdConsent } from "./ad-pixel";

const STATUS = {
  granted: "Permitiste la medición de anuncios en este navegador.",
  denied: "No permitiste la medición de anuncios en este navegador.",
  undecided: "Aún no decides: no se carga nada.",
} as const;

/** Cambiar la decisión sobre el pixel de TikTok (página de Cookies, ADR-072). */
export function AdConsentControl() {
  const consent = useAdConsent();
  return (
    <div
      role="group"
      aria-label="Tu decisión sobre la medición de anuncios"
      className="flex flex-col gap-2 rounded-xl border p-3"
    >
      {consent === undefined ? null : (
        <p className="text-sm" aria-live="polite">
          {STATUS[consent ?? "undecided"]}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={consent === "granted" ? "secondary" : "default"}
          aria-pressed={consent === "granted"}
          onClick={() => saveAdConsent(true)}
        >
          Permitir
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-pressed={consent === "denied"}
          onClick={() => saveAdConsent(false)}
        >
          No permitir
        </Button>
      </div>
    </div>
  );
}
