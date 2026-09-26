import type { Metadata, Viewport } from "next";
import { Figtree, Plus_Jakarta_Sans } from "next/font/google";
import { headers } from "next/headers";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { siteConfig } from "@/config/site";
import { NONCE_HEADER } from "@/lib/csp";
import { cn } from "@/lib/utils";
import { env } from "@/server/env";
import "./globals.css";

// Titulares: Plus Jakarta Sans (variable, 200–800; usamos 400–800). Texto: Figtree.
const display = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-display" });
const body = Figtree({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  metadataBase: new URL(env.APP_URL),
  title: { default: siteConfig.name, template: `%s · ${siteConfig.name}` },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  appleWebApp: { capable: true, title: siteConfig.name, statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Nonce de la CSP de esta petición (lo pone `src/proxy.ts`). Leer las cabeceras hace que todas
  // las páginas se rendericen por petición, que es lo que exige una CSP con nonce (ADR-029).
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;

  return (
    <html
      lang={siteConfig.locale}
      className={cn(display.variable, body.variable)}
      suppressHydrationWarning
    >
      <body>
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-foreground focus:px-3 focus:py-2 focus:text-background"
        >
          Saltar al contenido
        </a>
        <ThemeProvider nonce={nonce}>
          {children}
          {/* Debajo de la barra superior: 56 px en móvil y 64 px en escritorio, más 8 px de aire
              (y la muesca en móvil). Sonner usa `mobileOffset` hasta 600 px de ancho. */}
          <Toaster
            position="top-center"
            offset={{ top: 72 }}
            mobileOffset={{ top: "calc(64px + env(safe-area-inset-top, 0px))" }}
            toastOptions={{
              classNames: {
                // `cn-toast` es la clase que ya pone el Toaster de ui/sonner (se reemplaza todo el
                // objeto al pasar `toastOptions`).
                toast: "cn-toast",
                // «Deshacer»: se ve de 24 px y su área táctil llega a 44 px (10 px arriba y abajo,
                // dentro del relleno del aviso). El foco es sólido (el de sonner es negro al 40 %,
                // invisible en oscuro); `!` porque los estilos de sonner no van en capas.
                actionButton:
                  "relative after:absolute after:inset-x-0 after:-inset-y-2.5 focus-visible:shadow-none! focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring! focus-visible:outline-solid!",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
