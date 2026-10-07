"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import { useActionState, useState } from "react";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import type { RightsClaimantRole, RightsNoticeKind } from "@/generated/prisma/enums";
import { TurnstileField } from "@/modules/identity/components/turnstile-field";
import { type NoticeFormState, submitNoticeAction } from "../actions";
import { caseNumbersSentence } from "../case-number";
import { RIGHTS_TURNSTILE_ACTION } from "../constants";
import { CLAIMANT_ROLE_LABELS, RIGHTS_KIND_LABELS } from "../labels";
import { NOTICE_LIMITS } from "../schemas";
import { MAX_NOTICE_URLS } from "../urls";
import { ChoiceField, SwornCheckbox, TextAreaField } from "./form-fields";

const KINDS = (Object.keys(RIGHTS_KIND_LABELS) as RightsNoticeKind[]).map((value) => ({
  value,
  label: RIGHTS_KIND_LABELS[value],
}));
const ROLES = (Object.keys(CLAIMANT_ROLE_LABELS) as RightsClaimantRole[]).map((value) => ({
  value,
  label: CLAIMANT_ROLE_LABELS[value],
}));

const asKind = (value: string | undefined): RightsNoticeKind | "" =>
  KINDS.some((kind) => kind.value === value) ? (value as RightsNoticeKind) : "";
const asRole = (value: string | undefined): RightsClaimantRole | "" =>
  ROLES.some((role) => role.value === value) ? (value as RightsClaimantRole) : "";

/**
 * Formulario de aviso de derechos (LFDA art. 114 Octies fr. III; RLFDA art. 37 Quáter I–VII): un
 * campo por requisito, sin cuenta, gratis y sin documentos obligatorios. El domicilio y los hechos se
 * piden pero no detienen el aviso (`schemas.ts`). Las dos declaraciones nunca vienen marcadas. Al
 * enviarlo se muestra el número de caso (uno por cada cuenta que subió lo señalado); el correo de
 * acuse solo se promete si de verdad salió.
 */
export function NoticeForm({
  turnstileSiteKey,
  nonce,
  initialUrl,
}: {
  turnstileSiteKey?: string;
  nonce?: string;
  /** Dirección del contenido cuando se llega desde «Reportar» (ya validada: de este sitio). */
  initialUrl?: string;
}) {
  const [verified, setVerified] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [kind, setKind] = useState<RightsNoticeKind | "">("");
  const [role, setRole] = useState<RightsClaimantRole | "">("");
  const [state, formAction, pending] = useActionState<NoticeFormState, FormData>(
    async (previous, data) => {
      const result = await submitNoticeAction(previous, data);
      // Cada respuesta pide un token nuevo: el anterior pudo consumirse en Siteverify.
      setVerified(false);
      setAttempt((value) => value + 1);
      if (!result.ok) {
        setKind(asKind(result.values?.kind));
        setRole(asRole(result.values?.claimantRole));
      }
      return result;
    },
    {},
  );
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? (initialUrl ? { urls: initialUrl } : {});

  if (state.ok && state.caseNumbers?.length) {
    const several = state.caseNumbers.length > 1;
    return (
      <div
        role="status"
        className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-4"
      >
        <p className="flex items-center gap-2 text-lg font-bold">
          <CircleCheck className="size-5 text-primary-text" aria-hidden />
          Recibimos tu aviso
        </p>
        <p className="font-medium">{caseNumbersSentence(state.caseNumbers)}</p>
        <p className="text-sm text-muted-foreground">
          {state.emailSent
            ? `Te mandamos un acuse con ${several ? "estos números" : "este número"} a tu correo.`
            : `Anota ${several ? "los números" : "el número"}: por ahora no mandamos acuse por correo.`}{" "}
          Si nos escribes sobre este aviso, menciónalo. Lo revisa una persona del equipo y, si está
          completo, retiramos el contenido sin demora.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <ChoiceField
        legend="¿Qué derecho reclamas?"
        name="kind"
        options={KINDS}
        value={kind}
        onChange={setKind}
        errors={errors.kind}
      />
      {kind === "TRADEMARK" ? (
        <TextField
          label="Número de registro de la marca en el IMPI"
          name="trademarkRegistration"
          maxLength={NOTICE_LIMITS.trademark}
          required
          description="Solo atendemos marcas registradas. No aceptamos disputas de precios ni de distribución."
          defaultValue={values.trademarkRegistration}
          errors={errors.trademarkRegistration}
        />
      ) : null}

      <ChoiceField
        legend="¿En qué calidad avisas?"
        name="claimantRole"
        options={ROLES}
        value={role}
        onChange={setRole}
        errors={errors.claimantRole}
      />
      {role === "REPRESENTATIVE" ? (
        <TextField
          label="Nombre completo o razón social de quien es titular"
          name="principalName"
          maxLength={NOTICE_LIMITS.name}
          required
          description="No te pedimos el documento que lo acredita; si lo tienes, puedes mencionarlo abajo."
          defaultValue={values.principalName}
          errors={errors.principalName}
        />
      ) : null}

      <TextField
        label="Tu nombre completo o razón social"
        name="claimantName"
        autoComplete="name"
        maxLength={NOTICE_LIMITS.name}
        required
        defaultValue={values.claimantName}
        errors={errors.claimantName}
      />
      <TextField
        label="Correo"
        name="claimantEmail"
        type="email"
        autoComplete="email"
        inputMode="email"
        maxLength={NOTICE_LIMITS.email}
        required
        defaultValue={values.claimantEmail}
        errors={errors.claimantEmail}
      />
      <TextField
        label="Correo alterno (opcional)"
        name="claimantAltEmail"
        type="email"
        inputMode="email"
        maxLength={NOTICE_LIMITS.email}
        defaultValue={values.claimantAltEmail}
        errors={errors.claimantAltEmail}
      />
      <TextField
        label="Teléfono (opcional)"
        name="claimantPhone"
        type="tel"
        autoComplete="tel"
        maxLength={NOTICE_LIMITS.phone}
        defaultValue={values.claimantPhone}
        errors={errors.claimantPhone}
      />
      <TextAreaField
        label="Domicilio (opcional)"
        name="claimantDomicile"
        rows={2}
        autoComplete="street-address"
        maxLength={NOTICE_LIMITS.domicile}
        description="Calle, número, colonia, código postal, ciudad y estado. Lo pide el reglamento de la ley; si no lo escribes, igual atendemos tu aviso."
        defaultValue={values.claimantDomicile}
        errors={errors.claimantDomicile}
      />

      <TextAreaField
        label="Direcciones del contenido en speeaking"
        name="urls"
        rows={4}
        required
        placeholder={"https://www.speeaking.com/p/…\nhttps://www.speeaking.com/producto/…"}
        description={`Una por renglón, hasta ${MAX_NOTICE_URLS}. Cópialas de la barra del navegador o de «Compartir».`}
        defaultValue={values.urls}
        errors={errors.urls}
      />
      <TextAreaField
        label="¿Qué obra, marca o interpretación es?"
        name="workDescription"
        rows={3}
        maxLength={NOTICE_LIMITS.description}
        required
        description="Por ejemplo: «Fotografía “Atardecer en Bacalar”, publicada en mi portafolio en 2024»."
        defaultValue={values.workDescription}
        errors={errors.workDescription}
      />
      <TextAreaField
        label="¿Qué derecho tienes sobre ella?"
        name="rightDescription"
        rows={3}
        maxLength={NOTICE_LIMITS.description}
        required
        description="Por ejemplo: «Soy la autora y titular de los derechos patrimoniales». Si tienes un registro o un contrato, puedes mencionarlo; no es obligatorio."
        defaultValue={values.rightDescription}
        errors={errors.rightDescription}
      />
      <TextAreaField
        label="Cuéntanos brevemente qué pasó (opcional)"
        name="facts"
        rows={4}
        maxLength={NOTICE_LIMITS.facts}
        description="Por ejemplo: dónde se publicó antes tu obra y cómo te enteraste. Nos ayuda a revisarlo más rápido."
        defaultValue={values.facts}
        errors={errors.facts}
      />

      <p className="flex items-start gap-2 rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Tu aviso no es anónimo: si retiramos lo que señalas, quien subió el contenido recibe tu
          nombre, tu correo y la descripción de tu aviso. Si manda un contra-aviso, te enviamos una
          copia con su nombre, su contacto y su domicilio.
        </span>
      </p>

      <SwornCheckbox name="swornStatement" errors={errors.swornStatement}>
        Declaro bajo protesta de decir verdad que la información de este aviso es cierta, que según
        mi leal saber y entender el uso señalado no está autorizado y que soy titular del derecho o
        tengo autorización para actuar en su nombre.
      </SwornCheckbox>
      <SwornCheckbox name="penaltyAcknowledged" errors={errors.penaltyAcknowledged}>
        Sé que un aviso falso puede recibir una multa de 1,000 a 20,000 UMA (Ley Federal del Derecho
        de Autor, art. 232 Quinquies).
      </SwornCheckbox>

      {turnstileSiteKey ? (
        <TurnstileField
          key={attempt}
          siteKey={turnstileSiteKey}
          nonce={nonce}
          action={RIGHTS_TURNSTILE_ACTION}
          onVerifiedChange={setVerified}
        />
      ) : null}

      {state.error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="h-11 self-start px-5 text-base"
        disabled={pending || Boolean(turnstileSiteKey && !verified)}
      >
        {pending ? "Enviando…" : "Enviar aviso"}
      </Button>
    </form>
  );
}
