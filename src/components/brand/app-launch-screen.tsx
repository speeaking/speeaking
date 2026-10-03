import Image from "next/image";
import { siteConfig } from "@/config/site";

/** Apertura mientras se carga la app; desaparece en cuanto está disponible el contenido. */
export function AppLaunchScreen() {
  return (
    <main
      id="contenido"
      aria-busy="true"
      className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[#030911] px-6 py-12 text-white"
    >
      <Image
        src="/brand/launch-logo.webp"
        alt={`Logo de ${siteConfig.name}`}
        width={960}
        height={768}
        unoptimized
        preload
        className="h-auto w-full max-w-80 sm:max-w-96"
      />
      <span className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
        {siteConfig.name}
      </span>
      <div
        role="status"
        aria-live="polite"
        className="mt-2 h-1 w-12 animate-pulse rounded-full bg-linear-to-r from-violet-500 to-cyan-400 motion-reduce:animate-none"
      >
        <span className="sr-only">Abriendo {siteConfig.name}</span>
      </div>
    </main>
  );
}
