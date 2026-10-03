import type { Metadata } from "next";
import Link from "next/link";
import { PasswordResetForm } from "@/modules/identity/components/password-reset-form";
import { passwordResetTokenSchema } from "@/modules/identity/schemas";

export const metadata: Metadata = {
  title: "Nueva contraseña",
  robots: { index: false, follow: false },
};

export default async function PasswordResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; error?: string | string[] }>;
}) {
  const { token, error } = await searchParams;
  const parsed = passwordResetTokenSchema.safeParse(token);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold">Elige una nueva contraseña</h1>
        <p className="text-muted-foreground">
          Por seguridad, cerraremos tus sesiones en todos los dispositivos.
        </p>
      </div>
      {!error && parsed.success ? (
        <PasswordResetForm token={parsed.data} />
      ) : (
        <div className="flex flex-col gap-4">
          <p role="alert" className="text-sm text-destructive">
            Este enlace no es válido. Solicita uno nuevo para recuperar tu cuenta.
          </p>
          <Link
            href="/recuperar-contrasena"
            className="font-medium text-primary-text hover:underline"
          >
            Solicitar nuevo enlace
          </Link>
        </div>
      )}
    </div>
  );
}
