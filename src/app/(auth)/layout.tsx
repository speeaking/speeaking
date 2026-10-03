import { Logo } from "@/components/brand/logo";
import { NO_INDEX } from "@/app/seo";

export const metadata = { robots: NO_INDEX };

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main id="contenido" className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
      <Logo className="self-start" />
      <div className="flex flex-1 flex-col justify-center py-10">{children}</div>
    </main>
  );
}
