import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { googleAuthError } from "@/modules/identity/auth-errors";
import { GoogleButton } from "@/modules/identity/components/google-button";
import { SignInForm } from "@/modules/identity/components/sign-in-form";
import { getSession } from "@/modules/identity/session";
import { googleSignInEnabled } from "@/modules/identity/social";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage({ searchParams }: PageProps<"/entrar">) {
  const { next, error, password } = await searchParams;
  const safeNext = safeRedirectPath(next, "");
  const googleError = googleAuthError(error);
  if (await getSession()) redirect((safeNext || "/") as Route);
  const google = googleSignInEnabled();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-extrabold">Qué bueno verte</h1>
        <p className="text-muted-foreground">
          Entra para seguir descubriendo, comprando y vendiendo.
        </p>
      </div>
      {password === "actualizada" ? (
        <p role="status" className="rounded-xl bg-secondary px-3 py-2 text-sm">
          Tu contraseña se actualizó. Ya puedes entrar.
        </p>
      ) : null}
      {googleError ? (
        <div className="flex flex-col gap-3 rounded-xl bg-destructive/10 px-3 py-3">
          <p role="alert" className="text-sm text-destructive">
            {googleError.message}
          </p>
          {googleError.recoverAccount ? (
            <Link
              href="/recuperar-contrasena"
              className={buttonVariants({ variant: "outline", className: "self-start" })}
            >
              Recuperar mi cuenta
            </Link>
          ) : null}
        </div>
      ) : null}
      {google ? (
        <>
          <GoogleButton next={safeNext || undefined} intent="signin" />
          <p className="text-center text-xs text-muted-foreground">o con tu correo</p>
        </>
      ) : null}
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
