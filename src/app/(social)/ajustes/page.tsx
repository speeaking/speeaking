import { Camera, History, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { listSearchHistory } from "@/modules/analytics/privacy";
import { DiscoverableSwitch } from "@/modules/discovery/components/discoverable-switch";
import { isDiscoverable } from "@/modules/discovery/service";
import { SignOutButton } from "@/modules/identity/components/sign-out-button";
import {
  clearDeclaredInterestsAction,
  setDiscoverableAction,
} from "@/modules/identity/privacy-actions";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { DeleteAccountForm } from "@/modules/identity/components/delete-account-form";
import { TryOnPhotoList } from "@/modules/tryon/components/photo-list";
import { TRY_ON_RETENTION_DAYS } from "@/modules/tryon/consent";
import { listTryOnPhotos } from "@/modules/tryon/service";
import { db } from "@/server/db";
import { clearSearchHistoryAction, setPersonalizationAction } from "./actions";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const viewer = await requireOnboardedViewer("/ajustes");
  const [interests, intents, discoverable, searches, tryOnPhotos] = await Promise.all([
    db.userInterest.findMany({ where: { userId: viewer.userId }, select: { label: true } }),
    db.shoppingIntent.findMany({
      where: { userId: viewer.userId, status: "ACTIVE" },
      select: { query: true, budgetMaxCents: true },
    }),
    isDiscoverable(viewer.userId),
    listSearchHistory(viewer.userId),
    listTryOnPhotos(viewer.userId),
  ]);
  const enabled = viewer.profile.personalizationEnabled;

  return (
    <>
      <PageHeader title="Ajustes" description="Tu cuenta y tu privacidad." />
      <div className="flex flex-col gap-4 px-4 md:px-0">
        <section className="flex flex-col gap-3 rounded-3xl border bg-card p-4">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
            <ShieldCheck className="size-5" />
            Personalización
          </h2>
          <p className="text-sm text-muted-foreground">
            {enabled
              ? "Tu feed usa lo que haces aquí (me gusta, guardados, búsquedas, productos vistos). Nunca datos de otras apps. Si la desactivas, también desligamos de tu cuenta lo que ya hiciste."
              : "Tu feed no usa tu actividad y lo que hiciste antes ya no está ligado a tu cuenta. Solo contamos eventos de forma anónima y agregada."}
          </p>
          <form action={setPersonalizationAction.bind(null, !enabled)}>
            <Button type="submit" variant={enabled ? "outline" : "default"}>
              {enabled ? "Desactivar personalización" : "Activar personalización"}
            </Button>
          </form>
        </section>

        <section className="flex flex-col gap-3 rounded-3xl border bg-card p-4">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
            <Users aria-hidden="true" className="size-5" />
            Sugerencias de personas
          </h2>
          <DiscoverableSwitch initialEnabled={discoverable} action={setDiscoverableAction} />
        </section>

        <section className="flex flex-col gap-3 rounded-3xl border bg-card p-4">
          <h2 className="font-heading text-lg font-bold">Lo que nos dijiste que te gusta</h2>
          <p className="text-sm text-muted-foreground">
            {interests.length || intents.length
              ? [
                  ...interests.map((interest) => interest.label),
                  ...intents.map((intent) =>
                    intent.budgetMaxCents === null
                      ? `Busco: ${intent.query}`
                      : `Busco: ${intent.query} (hasta ${formatMoney(intent.budgetMaxCents)})`,
                  ),
                ].join(" · ")
              : "No nos has dicho qué te gusta ni qué buscas comprar."}
          </p>
          {interests.length || intents.length ? (
            <form action={clearDeclaredInterestsAction}>
              <Button type="submit" variant="outline">
                Borrar mis gustos declarados
              </Button>
            </form>
          ) : null}
        </section>

        <section className="flex flex-col gap-3 rounded-3xl border bg-card p-4">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
            <History aria-hidden="true" className="size-5" />
            Tus búsquedas
          </h2>
          <p className="text-sm text-muted-foreground">
            {searches.length
              ? "Las usamos para mostrarte «Porque buscaste…» en tu feed. Solo tú las ves."
              : enabled
                ? "No tienes búsquedas guardadas."
                : "Con la personalización desactivada no guardamos tus búsquedas."}
          </p>
          {searches.length ? (
            <>
              <ul aria-label="Búsquedas recientes" className="flex flex-wrap gap-2">
                {searches.map((search) => (
                  <li
                    key={search.query}
                    className="rounded-full bg-muted px-3 py-1 text-sm break-all"
                  >
                    {search.query}
                  </li>
                ))}
              </ul>
              <form action={clearSearchHistoryAction}>
                <Button type="submit" variant="outline">
                  Borrar historial de búsqueda
                </Button>
              </form>
            </>
          ) : null}
        </section>

        <section className="flex flex-col gap-3 rounded-3xl border bg-card p-4">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
            <Camera aria-hidden="true" className="size-5" />
            Mis fotos de prueba
          </h2>
          <p className="text-sm text-muted-foreground">
            Las fotos que subes para «Pruébatelo» y cada simulación son privadas: solo tú las ves,
            no se comparten con nadie y se borran solas a los {TRY_ON_RETENTION_DAYS} días. Aquí
            puedes borrarlas antes.
          </p>
          <TryOnPhotoList photos={tryOnPhotos} />
        </section>

        <section
          aria-labelledby="borrar-cuenta"
          className="flex flex-col gap-3 rounded-3xl border bg-card p-4 text-sm"
        >
          <h2 id="borrar-cuenta" className="font-heading text-lg font-bold">
            Borrar mi cuenta
          </h2>
          <p className="text-muted-foreground">
            Se borra de inmediato y de verdad (ADR-048). Descargar tus datos llegará después;
            mientras, puedes pedirlos por el correo del{" "}
            <Link href="/privacidad" className="font-semibold underline">
              aviso de privacidad
            </Link>
            .
          </p>
          <DeleteAccountForm />
        </section>

        <SignOutButton />
      </div>
    </>
  );
}
