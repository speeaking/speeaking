"use client";

import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { completeOnboardingAction, type OnboardingFormState } from "../onboarding-actions";
import { BRAND_SUGGESTIONS, GOAL_OPTIONS, MIN_COMMUNITIES } from "../onboarding-options";

type Community = { slug: string; name: string; emoji: string; hue: number; description: string };

const STEP_TITLES = ["Cuéntanos de ti", "Elige tus comunidades", "Para conocerte mejor"] as const;
const STEP_ONE_FIELDS = ["username", "displayName", "goals", "acceptLegal"];

// El paso se refleja en la URL (?paso=2) para que el botón Atrás del navegador (o de Android)
// regrese un paso en lugar de salir del cuestionario. Next integra window.history con su router,
// así que el formulario no se desmonta y conserva lo que ya elegiste.
const STEP_PARAM = "paso";
const STEP_STATE_KEY = "onboardingStep";

function stepFromUrl() {
  const value = Number(new URLSearchParams(window.location.search).get(STEP_PARAM));
  return Number.isInteger(value) && value >= 1 && value <= STEP_TITLES.length ? value - 1 : 0;
}

function urlForStep(step: number) {
  const url = new URL(window.location.href);
  if (step === 0) url.searchParams.delete(STEP_PARAM);
  else url.searchParams.set(STEP_PARAM, String(step + 1));
  return `${url.pathname}${url.search}${url.hash}`;
}

/** «Gaming y Deportes» (conjunción en español). */
const listFormat = new Intl.ListFormat("es-MX", { style: "long", type: "conjunction" });

const chip =
  "group flex cursor-pointer items-center gap-2 rounded-2xl border bg-card px-3.5 py-2.5 text-sm font-medium transition-colors select-none has-checked:border-foreground has-checked:bg-foreground has-checked:text-background has-focus-visible:ring-3 has-focus-visible:ring-ring";

export function OnboardingForm({
  communities,
  suggestedUsername,
  defaultName,
  next,
  preselected = [],
  needsLegalConsent = false,
}: {
  communities: Community[];
  suggestedUsername: string;
  defaultName: string;
  /** Adónde regresa al terminar (ya validado en el servidor): la publicación o comunidad de origen. */
  next?: string;
  /** La cuenta llegó por Google y aún no acepta términos ni aviso (ADR-049): casilla obligatoria. */
  needsLegalConsent?: boolean;
  /**
   * Comunidades que eligió antes de tener cuenta (`?unirse=`, ya validadas en el servidor): llegan
   * marcadas y primero en el paso 2. Se pueden quitar.
   */
  preselected?: readonly string[];
}) {
  const [state, formAction, pending] = useActionState<OnboardingFormState, FormData>(
    completeOnboardingAction,
    {},
  );
  const [, startSubmit] = useTransition();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>(() => [...preselected]);
  const chosenFirst = [
    ...communities.filter((community) => preselected.includes(community.slug)),
    ...communities.filter((community) => !preselected.includes(community.slug)),
  ];
  const preselectedNames = chosenFirst
    .filter((community) => preselected.includes(community.slug))
    .map((community) => community.name);
  const [handledState, setHandledState] = useState(state);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(step);

  // Si el servidor rechaza datos de un paso anterior, regresamos a ese paso (ajuste durante el
  // render cuando cambia la respuesta, en lugar de un efecto).
  if (state !== handledState) {
    setHandledState(state);
    const fields = Object.keys(state.fieldErrors ?? {});
    if (fields.some((field) => STEP_ONE_FIELDS.includes(field))) setStep(0);
    else if (fields.includes("communities")) setStep(1);
  }

  useEffect(() => {
    const onPopState = () => setStep(stepFromUrl());
    window.addEventListener("popstate", onPopState);
    // Si la URL ya trae un paso (recargaste o regresaste desde otra página), el formulario empezó
    // de cero: la devolvemos al paso 1 sin crear otra entrada. Se difiere un turno porque, en una
    // carga completa, Next integra window.history después de los efectos de sus hijos.
    const timer = window.setTimeout(() => {
      if (stepFromUrl() !== 0) window.history.replaceState(null, "", urlForStep(0));
    });
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.clearTimeout(timer);
    };
  }, []);

  // Cada cambio de paso empieza arriba y lleva el foco al título (lectores de pantalla y teclado).
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    // El servidor nos regresó a un paso anterior: la URL se corrige sin crear otra entrada. La
    // entrada no se marca con el paso porque la anterior no es "un paso atrás" (puede ser el mismo
    // paso o incluso otra página), así que "Atrás" debe crear una entrada en vez de usar el historial.
    if (stepFromUrl() !== step) {
      window.history.replaceState(null, "", urlForStep(step));
    }
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const goToStep = (next: number) => {
    setStep(next);
    window.history.pushState({ [STEP_STATE_KEY]: next }, "", urlForStep(next));
  };

  // "Atrás" equivale al botón del navegador cuando llegaste a este paso con "Siguiente".
  const goBack = () => {
    const historyStep = (window.history.state as Record<string, unknown> | null)?.[STEP_STATE_KEY];
    if (historyStep === step) window.history.back();
    else goToStep(step - 1);
  };

  const toggleCommunity = (slug: string, checked: boolean) =>
    setSelected((current) =>
      checked ? [...current, slug] : current.filter((value) => value !== slug),
    );

  const brandSuggestions = [
    ...new Set(selected.flatMap((slug) => BRAND_SUGGESTIONS[slug] ?? [])),
  ].slice(0, 15);
  const enoughCommunities = selected.length >= MIN_COMMUNITIES;
  const missingCommunities = MIN_COMMUNITIES - selected.length;

  // Enter en un campo envía el formulario aunque "Empezar" esté oculto, y terminaría el cuestionario
  // a medias. Antes del último paso equivale a "Siguiente".
  const advanceOnEnter = (event: KeyboardEvent<HTMLFormElement>) => {
    if (step === STEP_TITLES.length - 1 || event.key !== "Enter" || event.nativeEvent.isComposing) {
      return;
    }
    if (!(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    if (step === 0 || enoughCommunities) goToStep(step + 1);
  };

  // React 19 vacía los campos no controlados al terminar una acción de formulario, también cuando el
  // servidor devuelve un error (p. ej. «usuario ocupado»): las comunidades volvían a las de
  // `defaultChecked` mientras `selected` decía otra cosa. Con JavaScript se envía a mano (sin ese
  // reinicio); sin JavaScript, `action` sigue funcionando.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startSubmit(() => formAction(data));
  };

  return (
    <form
      action={formAction}
      onSubmit={submit}
      onKeyDown={advanceOnEnter}
      noValidate
      className="flex flex-col gap-6"
    >
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="flex flex-col gap-3">
        <div className="flex gap-1.5" aria-hidden="true">
          {STEP_TITLES.map((title, index) => (
            <span
              key={title}
              className={cn(
                "h-1.5 flex-1 rounded-full bg-foreground/15 transition-colors",
                index <= step && "bg-primary",
              )}
            />
          ))}
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          Paso {step + 1} de {STEP_TITLES.length}
        </p>
        <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold outline-none">
          {STEP_TITLES[step]}
        </h1>
      </div>

      {/* Paso 1: perfil y objetivos */}
      <section hidden={step !== 0} className="flex flex-col gap-5">
        <TextField
          label="¿Cómo te llamas?"
          name="displayName"
          autoComplete="name"
          defaultValue={defaultName}
          errors={state.fieldErrors?.displayName}
        />
        <TextField
          label="Nombre de usuario"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          defaultValue={suggestedUsername}
          description="Así te encontrarán: @usuario. Letras sin acento, números, punto y guion bajo."
          errors={state.fieldErrors?.username}
        />
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-sm font-medium">
            ¿Qué te trae por aquí? (elige las que quieras)
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {GOAL_OPTIONS.map((goal) => (
              <label key={goal.value} className={chip}>
                <input type="checkbox" name="goals" value={goal.value} className="sr-only" />
                <span aria-hidden="true">{goal.emoji}</span>
                {goal.label}
                <Check className="ml-auto size-4 shrink-0 opacity-0 transition-opacity group-has-checked:opacity-100" />
              </label>
            ))}
          </div>
        </fieldset>
        {needsLegalConsent ? (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="acceptLegal"
              required
              className="mt-0.5 size-4 shrink-0 accent-primary"
              aria-invalid={state.fieldErrors?.acceptLegal ? true : undefined}
            />
            <span>
              Acepto los{" "}
              <Link
                href="/terminos"
                className="font-medium underline underline-offset-2"
                target="_blank"
              >
                términos
              </Link>{" "}
              y el{" "}
              <Link
                href="/privacidad"
                className="font-medium underline underline-offset-2"
                target="_blank"
              >
                aviso de privacidad
              </Link>
              .
            </span>
          </label>
        ) : null}
        {state.fieldErrors?.acceptLegal ? (
          <p role="alert" className="text-sm text-destructive">
            {state.fieldErrors.acceptLegal[0]}
          </p>
        ) : null}
        <Button type="button" size="lg" className="h-11 text-base" onClick={() => goToStep(1)}>
          Siguiente
        </Button>
      </section>

      {/* Paso 2: comunidades (mínimo 3) */}
      <section hidden={step !== 1} className="flex flex-col gap-5">
        <p className="text-muted-foreground">
          Elige al menos {MIN_COMMUNITIES}. Así tu feed tendrá contenido que te guste desde el
          primer minuto.
        </p>
        {preselectedNames.length > 0 ? (
          <p className="-mt-2 text-sm text-ink-2">
            Ya marcamos {listFormat.format(preselectedNames)}:{" "}
            {preselectedNames.length === 1 ? "la" : "las"} elegiste antes de crear tu cuenta.
          </p>
        ) : null}
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="sr-only">Comunidades</legend>
          {chosenFirst.map((community) => (
            <label
              key={community.slug}
              style={{ "--hue": community.hue } as CSSProperties}
              className="group flex cursor-pointer flex-col gap-1 rounded-2xl border bg-card p-3 transition-colors select-none has-checked:community-border has-checked:community-soft has-focus-visible:ring-3 has-focus-visible:ring-ring"
            >
              <input
                type="checkbox"
                name="communities"
                value={community.slug}
                defaultChecked={preselected.includes(community.slug)}
                className="sr-only"
                onChange={(event) => toggleCommunity(community.slug, event.target.checked)}
              />
              <span className="flex items-center justify-between text-2xl">
                <span aria-hidden="true">{community.emoji}</span>
                <Check className="size-4 opacity-0 transition-opacity group-has-checked:opacity-100" />
              </span>
              <span className="font-heading font-bold">{community.name}</span>
              <span className="line-clamp-2 text-xs opacity-75">{community.description}</span>
            </label>
          ))}
        </fieldset>
        {state.fieldErrors?.communities ? (
          <p role="alert" className="text-sm text-destructive">
            {state.fieldErrors.communities[0]}
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="lg" className="h-11" onClick={goBack}>
            <ArrowLeft data-icon="inline-start" />
            Atrás
          </Button>
          <p
            id="comunidades-faltantes"
            aria-live="polite"
            className="text-sm whitespace-nowrap text-muted-foreground"
          >
            {enoughCommunities
              ? null
              : missingCommunities === 1
                ? "Te falta 1"
                : `Te faltan ${missingCommunities}`}
          </p>
          <Button
            type="button"
            size="lg"
            className="h-11 flex-1 text-base"
            disabled={!enoughCommunities}
            aria-describedby={enoughCommunities ? undefined : "comunidades-faltantes"}
            onClick={() => goToStep(2)}
          >
            Siguiente
          </Button>
        </div>
      </section>

      {/* Paso 3: marcas, intención de compra y personalización (todo opcional) */}
      <section hidden={step !== 2} className="flex flex-col gap-6">
        {brandSuggestions.length > 0 ? (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-sm font-medium">Marcas que te gustan (opcional)</legend>
            <div className="flex flex-wrap gap-2">
              {brandSuggestions.map((brand) => (
                <label key={brand} className={chip}>
                  <input type="checkbox" name="brands" value={brand} className="sr-only" />
                  <Check className="-ml-1 hidden size-4 shrink-0 group-has-checked:block" />
                  {brand}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="flex flex-col gap-3 rounded-3xl border bg-card p-4">
          <p className="font-heading text-lg font-bold">¿Buscas algo ahora? (opcional)</p>
          <TextField
            label="¿Qué buscas?"
            name="intentQuery"
            placeholder="Ej. una laptop para editar video"
            errors={state.fieldErrors?.intentQuery}
          />
          <div className="flex flex-col gap-2">
            <label htmlFor="campo-budgetMax" className="text-sm font-medium">
              ¿Hasta cuánto quieres gastar?
            </label>
            <div className="relative">
              <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="campo-budgetMax"
                name="budgetMax"
                inputMode="decimal"
                placeholder="25,000"
                className="h-11 pl-7 text-base"
                aria-invalid={state.fieldErrors?.budgetMaxCents ? true : undefined}
              />
              <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                MXN
              </span>
            </div>
            {state.fieldErrors?.budgetMaxCents ? (
              <p role="alert" className="text-sm text-destructive">
                {state.fieldErrors.budgetMaxCents[0]}
              </p>
            ) : null}
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-3xl border bg-card p-4 text-sm leading-snug">
          <input
            type="checkbox"
            name="personalization"
            defaultChecked
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span>
            <span className="font-semibold">Personalizar mi feed con mi actividad aquí.</span>{" "}
            Usamos solo lo que haces dentro de la plataforma, nunca datos de otras apps. Puedes
            cambiarlo cuando quieras.{" "}
            <Link href="/privacidad" target="_blank" className="underline underline-offset-2">
              Aviso de privacidad
            </Link>
          </span>
        </label>

        {state.error ? (
          <p
            role="alert"
            className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {state.error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="lg" className="h-11" onClick={goBack}>
            <ArrowLeft data-icon="inline-start" />
            Atrás
          </Button>
          <Button type="submit" size="lg" className="h-11 flex-1 text-base" disabled={pending}>
            {pending ? "Preparando tu feed…" : "Empezar"}
          </Button>
        </div>
      </section>
    </form>
  );
}
