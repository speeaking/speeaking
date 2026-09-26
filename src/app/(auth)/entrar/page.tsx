import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { SignInForm } from "@/modules/identity/components/sign-in-form";
import { getSession } from "@/modules/identity/session";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage({ searchParams }: PageProps<"/entrar">) {
  const { next } = await searchParams;
  const safeNext = safeRedirectPath(next, "");
  if (await getSession()) redirect((safeNext || "/") as Route);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-extrabold">Qué bueno verte</h1>
        <p className="text-muted-foreground">
          Entra para seguir descubriendo, comprando y vendiendo.
        </p>
      </div>
      <SignInForm next={safeNext || undefined} />
      <div className="flex flex-col gap-2 border-t pt-6">
        <p className="text-center text-sm text-muted-foreground">¿No tienes cuenta?</p>
        <Link
          href={
            (safeNext ? `/registro?next=${encodeURIComponent(safeNext)}` : "/registro") as Route
          }
          className={buttonVariants({
            variant: "outline",
            size: "lg",
            className: "h-11 text-base",
          })}
        >
          Crea una gratis
        </Link>
      </div>
    </div>
  );
}
