"use client";

import { CSPProvider } from "@base-ui/react/csp-provider";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Tema (next-themes) y nonce de la CSP (SEC-06). El nonce llega del layout raíz: lo necesitan el
 * script que fija el tema antes de pintar (sin él, parpadeo y violación de CSP) y los `<script>` o
 * `<style>` en línea de Base UI.
 */
export function ThemeProvider({ children, nonce }: { children: ReactNode; nonce?: string }) {
  return (
    <CSPProvider nonce={nonce}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        nonce={nonce}
      >
        {children}
      </NextThemesProvider>
    </CSPProvider>
  );
}
