import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CommunityAvatar } from "@/components/brand/community-avatar";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { GoogleButton } from "@/modules/identity/components/google-button";
import { SignUpForm } from "@/modules/identity/components/sign-up-form";
import { googleSignInEnabled } from "@/modules/identity/social";
import { listCommunities } from "@/modules/identity/service";
import { getSession } from "@/modules/identity/session";
import { onboardingPath, parseJoinSlugs } from "../unirse";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function SignUpPage({ searchParams }: PageProps<"/registro">) {
  const { next, unirse } = await searchParams;
  const safeNext = safeRedirectPath(next, "");
  if (await getSession()) redirect((safeNext || "/") as Route);

  // `?unirse=gaming`: solo comunidades que existen, en el orden en que llegaron.
  const requested = parseJoinSlugs(unirse);
  const catalog = requested.length > 0 ? await listCommunities() : [];
  const joining = requested.flatMap((slug) => catalog.filter((c) => c.slug === slug));
  // Después de crear la cuenta, la bienvenida llega con esas comunidades ya marcadas.
  // Al terminar las preferencias, la nueva cuenta empieza en el feed.
  const formNext =
    joining.length > 0
      ? onboardingPath({ join: joining.map((community) => community.slug), next: safeNext })
      : safeNext;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-extrabold">Únete a la comunidad</h1>
        <p className="text-muted-foreground">
          Descubre contenido, encuentra lo que buscas y vende con ayuda de la IA.
        </p>
      </div>
      {joining.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-3xl border bg-card p-4">
          <p className="text-sm font-semibold">Empezarás en</p>
          <ul className="flex flex-wrap gap-2">
            {joining.map((community) => (
              <li
                key={community.slug}
                className="inline-flex items-center gap-2 rounded-full bg-secondary py-1 pr-3.5 pl-1.5 text-sm font-semibold"
              >
                <CommunityAvatar
                  name={community.name}
                  emoji={community.emoji}
                  hue={community.hue}
                  size="sm"
                  decorative
                  className="size-7 rounded-full text-sm"
                />
                {community.name}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Podrás elegir más (o quitarlas) al crear tu perfil.
          </p>
        </div>
      ) : null}
      {googleSignInEnabled() ? (
        <>
          <GoogleButton next={formNext || undefined} intent="signup" />
          <p className="text-center text-xs text-muted-foreground">o con tu correo</p>
        </>
      ) : null}
      <SignUpForm next={formNext || undefined} />
      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link
          href={(safeNext ? `/entrar?next=${encodeURIComponent(safeNext)}` : "/entrar") as Route}
          className="font-semibold text-foreground underline underline-offset-2"
        >
          Entra
        </Link>
      </p>
    </div>
  );
}
