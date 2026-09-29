"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AcceptLegalResult } from "../privacy-actions";
import type { PendingLegalDocument, RefreshableConsent } from "../consent-refresh";

const DOCUMENTS: Record<RefreshableConsent, { href: "/privacidad" | "/terminos"; label: string }> =
  {
    PRIVACY_NOTICE: { href: "/privacidad", label: "Aviso de privacidad" },
    TERMS: { href: "/terminos", label: "Términos y condiciones" },
  };

/** «Actualizamos …» con solo los documentos que cambiaron (el texto no promete lo que no pasó). */
export function consentBannerTitle(documents: readonly PendingLegalDocument[]) {
  const types = new Set(documents.map((document) => document.type));
  if (types.has("PRIVACY_NOTICE") && types.has("TERMS")) {
    return "Actualizamos el aviso de privacidad y los términos. Revisa los cambios";
  }
  return types.has("TERMS")
    ? "Actualizamos los términos y condiciones. Revisa los cambios"
    : "Actualizamos el aviso de privacidad. Revisa los cambios";
}

/**
 * Llave del «Ocultar» en sessionStorage: lleva las versiones, así que una versión nueva vuelve a
 * mostrar el aviso aunque se haya ocultado la anterior en la misma sesión.
 */
export function dismissKey(documents: readonly PendingLegalDocument[]) {
  const versions = documents.map((document) => `${document.type}@${document.version}`).join(",");
  return `vendeia.consent-refresh:${versions}`;
}

/**
 * Aviso (no bloquea) para quien aceptó una versión anterior del aviso de privacidad o de los
 * términos (`identity/consent-refresh.ts`). «Aceptar» manda las versiones que se mostraron y el
 * servidor registra solo esas (si mientras tanto cambió alguna, no la registra y el aviso se vuelve a
 * pintar con la nueva). «Ocultar» lo esconde solo en esta pestaña mientras siga abierta
 * (sessionStorage) y vuelve a aparecer en otra, hasta que la persona acepte.
 */
export function ConsentBanner({
  documents,
  action,
}: {
  documents: readonly PendingLegalDocument[];
  action: (shown: readonly PendingLegalDocument[]) => Promise<AcceptLegalResult>;
}) {
  const router = useRouter();
  const dismissed = useSessionFlag(dismissKey(documents));
  const [accepted, setAccepted] = useState(false);
  const [pending, startTransition] = useTransition();

  if (documents.length === 0 || accepted || dismissed.value) return null;

  const accept = () =>
    startTransition(async () => {
      try {
        const result = await action(documents);
        if (result.ok) {
          setAccepted(true);
          toast.success("Gracias. Guardamos tu aceptación.");
        } else {
          toast.error(result.error);
          // Cambió una versión desde que se pintó: se vuelve a pedir el aviso con la vigente.
          if (result.stale) router.refresh();
        }
      } catch {
        toast.error("No pudimos guardar tu aceptación. Intenta de nuevo.");
      }
    });

  return (
    <section
      aria-label="Cambios en los documentos legales"
      className="border-b border-border bg-secondary text-foreground"
    >
      <div className="mx-auto flex w-full max-w-[1352px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-sm md:px-6">
        <p className="min-w-0 flex-1 basis-64 font-medium">
          {consentBannerTitle(documents)}:{" "}
          {documents.map((document, index) => (
            <span key={document.type}>
              {index > 0 ? " · " : null}
              <Link
                href={DOCUMENTS[document.type].href}
                className="font-semibold text-primary-text underline underline-offset-4"
              >
                {DOCUMENTS[document.type].label}
              </Link>
            </span>
          ))}
          .
        </p>
        <div className="flex items-center gap-1">
          {/* En móvil, 44 px de alto: el mínimo cómodo para el dedo. */}
          <Button onClick={accept} disabled={pending} className="h-11 px-4 md:h-8">
            {pending ? "Guardando…" : "Aceptar"}
          </Button>
          <Button
            size="icon-lg"
            variant="ghost"
            className="size-11 md:size-9"
            aria-label="Ocultar por ahora"
            title="Ocultar por ahora"
            onClick={dismissed.set}
            disabled={pending}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Bandera en sessionStorage (si no está disponible, p. ej. en modo privado, vale solo en esta vista). */
function useSessionFlag(key: string) {
  const [closedHere, setClosedHere] = useState(false);
  const stored = useSyncExternalStore(
    subscribeToStorage,
    () => readSessionFlag(key),
    () => false,
  );
  return {
    value: closedHere || stored,
    set: () => {
      try {
        window.sessionStorage.setItem(key, "1");
      } catch {
        // Sin almacenamiento: se oculta solo en esta vista.
      }
      setClosedHere(true);
    },
  };
}

function subscribeToStorage(listener: () => void) {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

function readSessionFlag(key: string) {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
