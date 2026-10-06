import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { OnboardingForm } from "@/modules/identity/components/onboarding-form";
import { RegistrationEvent } from "@/modules/marketing/components/registration-event";
import { configuredTikTokPixel } from "@/modules/marketing/server";
import {
  hasLegalConsents,
  listCommunities,
  suggestAvailableUsername,
} from "@/modules/identity/service";
import { requireViewer } from "@/modules/identity/session";
import { onboardingPath, parseJoinSlugs, unwrapOnboardingNext } from "../unirse";

export const metadata: Metadata = { title: "Bienvenida" };

export default async function OnboardingPage({ searchParams }: PageProps<"/bienvenida">) {
  const { next, unirse } = await searchParams;
  const safeNext = safeRedirectPath(next, "");

  // Desde el registro, `next` trae el onboarding completo con `unirse` (ver ../unirse.ts): se
  // desenvuelve una vez para dejar una URL limpia (`/bienvenida?unirse=gaming&next=/p/1`).
  const nested = unwrapOnboardingNext(safeNext);
  if (nested) {
    redirect(
      onboardingPath({
        join: parseJoinSlugs([...parseJoinSlugs(unirse), ...nested.join]),
        next: nested.next,
      }) as Route,
    );
  }

  const join = parseJoinSlugs(unirse);
  const viewer = await requireViewer(onboardingPath({ join, next: safeNext }));
  if (viewer.profile?.onboarded) redirect((safeNext || "/") as Route);

  const [communities, suggestedUsername, legalAccepted] = await Promise.all([
    listCommunities(),
    viewer.profile?.username ?? suggestAvailableUsername(viewer.name),
    hasLegalConsents(viewer.userId),
  ]);
  // Solo se marcan comunidades que existen (la URL la puede escribir cualquiera).
  const known = new Set(communities.map((community) => community.slug));
  const preselected = join.filter((slug) => known.has(slug));

  return (
    <>
      {/* Aquí solo llega quien aún no termina la bienvenida: una cuenta recién creada (ADR-072). */}
      {configuredTikTokPixel() ? <RegistrationEvent /> : null}
      <OnboardingForm
        communities={communities}
        suggestedUsername={suggestedUsername}
        defaultName={viewer.profile?.displayName ?? viewer.name}
        preselected={preselected}
        needsLegalConsent={!legalAccepted}
      />
    </>
  );
}
