import { Logo } from "@/components/brand/logo";
import { NO_INDEX } from "@/app/seo";
import { AdPixel } from "@/modules/marketing/components/ad-pixel";
import { configuredTikTokPixel } from "@/modules/marketing/server";

export const metadata = { robots: NO_INDEX };

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main id="contenido" className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
      <Logo className="self-start" />
      <div className="flex flex-1 flex-col justify-center py-10">{children}</div>
      {/* Aquí solo cuentan el registro y la bienvenida (`pixelAllowedOn`), nunca entrar a la cuenta. */}
      <AdPixel pixelId={configuredTikTokPixel()} signedIn={false} />
    </main>
  );
}
