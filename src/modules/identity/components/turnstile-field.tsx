"use client";

import Script from "next/script";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { TurnstileAction } from "../turnstile";

type TurnstileApi = {
  ready: (callback: () => void) => void;
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: TurnstileAction;
      theme: "light" | "dark";
      size: "flexible";
      language: "es";
      retry: "never";
      "response-field": false;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => boolean;
      "timeout-callback": () => void;
    },
  ) => string | undefined;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Render explícito: funciona al navegar entre formularios sin recargar la app. */
export function TurnstileField({
  siteKey,
  nonce,
  action,
  onVerifiedChange,
}: {
  siteKey: string;
  nonce?: string;
  action: TurnstileAction;
  onVerifiedChange: (verified: boolean) => void;
}) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "light";
  const container = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"loading" | "verified" | "error">("loading");

  useEffect(() => {
    if (scriptReady || scriptFailed) return;
    const timer = window.setTimeout(() => {
      setScriptFailed(true);
      setToken("");
      onVerifiedChange(false);
    }, 20000);
    return () => window.clearTimeout(timer);
  }, [scriptReady, scriptFailed, onVerifiedChange]);

  useEffect(() => {
    if (!scriptReady || !container.current || !window.turnstile) return;
    const api = window.turnstile;
    const element = container.current;
    let active = true;
    let widgetId: string | undefined;
    setToken("");
    setStatus("loading");
    onVerifiedChange(false);

    const invalidate = () => {
      if (!active) return;
      setToken("");
      setStatus("error");
      onVerifiedChange(false);
    };
    api.ready(() => {
      if (!active) return;
      try {
        widgetId = api.render(element, {
          sitekey: siteKey,
          action,
          theme,
          size: "flexible",
          language: "es",
          retry: "never",
          "response-field": false,
          callback: (value) => {
            if (!active) return;
            setToken(value);
            setStatus("verified");
            onVerifiedChange(true);
          },
          "expired-callback": invalidate,
          "timeout-callback": invalidate,
          "error-callback": () => {
            invalidate();
            return true;
          },
        });
        if (!widgetId) invalidate();
      } catch {
        invalidate();
      }
    });
    return () => {
      active = false;
      if (widgetId) api.remove(widgetId);
    };
  }, [scriptReady, siteKey, action, theme, attempt, onVerifiedChange]);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Script
        id="cloudflare-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        nonce={nonce}
        onReady={() => {
          setScriptFailed(false);
          setScriptReady(true);
        }}
        onError={() => {
          setScriptFailed(true);
          setToken("");
          onVerifiedChange(false);
        }}
      />
      <input type="hidden" name="cf-turnstile-response" value={token} />
      <div ref={container} aria-label="Verificación de seguridad" className="min-w-0" />
      {scriptFailed || status === "error" ? (
        <div className="flex flex-col items-start gap-1">
          <p role="alert" className="text-sm text-destructive">
            {scriptFailed
              ? "No cargó la verificación de seguridad. Recarga la página para continuar."
              : "La verificación caducó o no se completó. Intenta de nuevo."}
          </p>
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            onClick={() => {
              if (scriptFailed) window.location.reload();
              else {
                setToken("");
                setStatus("loading");
                onVerifiedChange(false);
                setAttempt((value) => value + 1);
              }
            }}
          >
            {scriptFailed ? "Recargar página" : "Reintentar verificación"}
          </Button>
        </div>
      ) : (
        <p role="status" className="text-xs text-muted-foreground">
          {status === "verified" ? "Verificación completada." : "Comprobando que eres una persona…"}
        </p>
      )}
      <noscript>
        <p className="text-sm text-destructive">
          Activa JavaScript para completar la verificación.
        </p>
      </noscript>
    </div>
  );
}
