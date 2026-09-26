import { Logo } from "@/components/brand/logo";

export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <main id="contenido" className="mx-auto w-full max-w-2xl px-5 py-8">
      <Logo />
      <article className="mt-8 flex flex-col gap-4 leading-relaxed [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </article>
    </main>
  );
}
