import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { PasswordRecoveryForm } from "@/modules/identity/components/password-recovery-form";
import { NONCE_HEADER } from "@/lib/csp";
import { turnstileSiteKey } from "@/modules/identity/turnstile";

export const metadata: Metadata = {
  title: "Recuperar contraseña",
  robots: { index: false, follow: false },
};

export default async function PasswordRecoveryPage() {
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/entrar"
        className="flex items-center gap-2 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a entrar
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold">Recupera tu contraseña</h1>
        <p className="text-muted-foreground">
          Te enviaremos un enlace para elegir una nueva y volver a tu cuenta.
        </p>
      </div>
      <PasswordRecoveryForm turnstileSiteKey={turnstileSiteKey()} nonce={nonce} />
    </div>
  );
}
