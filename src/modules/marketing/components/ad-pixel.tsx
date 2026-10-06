"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { type AdConsent, pixelAllowedOn } from "../ad-pixel";
import {
  activateTikTokPixel,
  deactivateTikTokPixel,
  readAdConsent,
  saveAdConsent,
  subscribeAdConsent,
} from "../tiktok";

/** La decisión guardada; `undefined` en el servidor (no se sabe hasta leer la cookie). */
export function useAdConsent(): AdConsent | null | undefined {
  return useSyncExternalStore(subscribeAdConsent, readAdConsent, () => undefined);
}

/**
 * Pixel de TikTok para medir anuncios (ADR-072). Sin ID configurado no hace nada. En las páginas
 * públicas, el registro y la bienvenida pregunta una vez; solo con «Aceptar» se carga. En cualquier
 * otra página (o con sesión, salvo la bienvenida) retira el permiso si ya estaba cargado.
 */
export function AdPixel({ pixelId, signedIn }: { pixelId: string | null; signedIn: boolean }) {
  const pathname = usePathname();
  const consent = useAdConsent();
  const allowed = pixelId !== null && pixelAllowedOn(pathname, { signedIn });

  useEffect(() => {
    if (pixelId === null) return;
    if (allowed && consent === "granted") {
      // A la bienvenida solo llega quien ya tiene sesión (aunque el layout de registro no lo sepa).
      activateTikTokPixel(pixelId, { withSession: signedIn || pathname === "/bienvenida" });
    } else deactivateTikTokPixel();
  }, [pixelId, allowed, consent, pathname, signedIn]);

  if (!allowed || consent !== null) return null;
  return (
    <section
      aria-label="Medición de anuncios"
      className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-50 flex flex-col gap-3 rounded-2xl border bg-card p-4 text-card-foreground shadow-lg md:inset-x-auto md:left-4 md:max-w-sm"
    >
      <p className="text-sm">
        ¿Nos dejas medir nuestros anuncios? Usamos el pixel de TikTok solo en páginas públicas y en
        el registro, para saber si un anuncio trajo a alguien. Nunca en tus mensajes, pedidos ni tu
        perfil.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => saveAdConsent(true)}>
          Aceptar
        </Button>
        <Button size="sm" variant="outline" onClick={() => saveAdConsent(false)}>
          No, gracias
        </Button>
        <Link
          href="/cookies#anuncios"
          className="ml-auto text-xs text-muted-foreground underline underline-offset-2"
        >
          Más información
        </Link>
      </div>
    </section>
  );
}
