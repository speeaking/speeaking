"use client";

import { TriangleAlert } from "lucide-react";
import { useActionState, useState } from "react";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import type { CounterNoticeBasis } from "@/generated/prisma/enums";
import { type CounterNoticeFormState, submitCounterNoticeAction } from "../actions";
import { COUNTER_NOTICE_BASIS_LABELS } from "../labels";
import { NOTICE_LIMITS } from "../schemas";
import { ChoiceField, SwornCheckbox, TextAreaField } from "./form-fields";

const BASES = (Object.keys(COUNTER_NOTICE_BASIS_LABELS) as CounterNoticeBasis[]).map((value) => ({
  value,
  label: COUNTER_NOTICE_BASIS_LABELS[value],
}));

/**
 * Contra-aviso (RLFDA art. 37 Septies) de quien subió el contenido retirado: nombre, contacto,
 * domicilio, fundamento y las dos declaraciones, que nunca vienen marcadas. Al recibirlo la página se
 * vuelve a pintar con la fecha en que se restaura.
 */
export function CounterNoticeForm({
  caseNumber,
  defaultName,
  defaultEmail,
}: {
  caseNumber: string;
  defaultName: string;
  defaultEmail: string;
}) {
  const [basis, setBasis] = useState<CounterNoticeBasis | "">("");
  const [state, formAction, pending] = useActionState<CounterNoticeFormState, FormData>(
    async (previous, data) => {
      const result = await submitCounterNoticeAction(previous, data);
      if (!result.ok) {
        const value = result.values?.basis;
        setBasis(BASES.some((item) => item.value === value) ? (value as CounterNoticeBasis) : "");
      }
      return result;
    },
    {},
  );
  const errors = state.fieldErrors ?? {};
  const values = state.values;

  if (state.ok) {
    return (
      <p role="status" className="rounded-xl border border-border bg-card px-4 py-3">
        Recibimos tu contra-aviso. Recarga la página para ver la fecha en que se restaura.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="caseNumber" value={caseNumber} />
      <TextField
        label="Tu nombre completo o razón social"
        name="name"
        autoComplete="name"
        maxLength={NOTICE_LIMITS.name}
        required
        defaultValue={values?.name ?? defaultName}
        errors={errors.name}
      />
      <TextField
        label="Correo"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        maxLength={NOTICE_LIMITS.email}
        required
        defaultValue={values?.email ?? defaultEmail}
        errors={errors.email}
      />
      <TextAreaField
        label="Domicilio"
        name="domicile"
        rows={2}
        autoComplete="street-address"
        maxLength={NOTICE_LIMITS.domicile}
        required
        description="Calle, número, colonia, código postal, ciudad y estado. Lo pide la ley para el contra-aviso."
        defaultValue={values?.domicile}
        errors={errors.domicile}
      />
      <ChoiceField
        legend="¿Por qué puedes publicarlo?"
        name="basis"
        options={BASES}
        value={basis}
        onChange={setBasis}
        errors={errors.basis}
      />
      <TextAreaField
        label="Explica tu fundamento"
        name="explanation"
        rows={5}
        maxLength={NOTICE_LIMITS.explanation}
        required
        description="Si tienes licencia o contrato, di con quién, cuándo y qué permite. Si es un uso permitido o de dominio público, explica por qué."
        defaultValue={values?.explanation}
        errors={errors.explanation}
      />

      <p className="flex items-start gap-2 rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Por ley mandamos una copia de tu contra-aviso, con tu nombre, tu contacto y tu domicilio,
          a quien presentó el aviso.
        </span>
      </p>

      <SwornCheckbox name="swornStatement" errors={errors.swornStatement}>
        Declaro bajo protesta de decir verdad que la información de este contra-aviso es cierta y
        que tengo derecho a publicar el contenido por el fundamento que elegí.
      </SwornCheckbox>
      <SwornCheckbox name="penaltyAcknowledged" errors={errors.penaltyAcknowledged}>
        Sé que un contra-aviso falso puede recibir una multa de 1,000 a 20,000 UMA (Ley Federal del
        Derecho de Autor, art. 232 Quinquies).
      </SwornCheckbox>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="h-11 self-start px-5 text-base" disabled={pending}>
        {pending ? "Enviando…" : "Enviar contra-aviso"}
      </Button>
    </form>
  );
}
