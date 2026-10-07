"use client";

import type { ComponentProps, ReactNode } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

/** Texto largo con etiqueta, ayuda y errores accesibles (como `TextField`). */
export function TextAreaField({
  label,
  description,
  errors,
  name,
  ...props
}: ComponentProps<typeof Textarea> & {
  label: string;
  description?: string;
  errors?: string[];
  name: string;
}) {
  const id = `campo-${name}`;
  const hasErrors = Boolean(errors?.length);
  return (
    <Field data-invalid={hasErrors || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea
        // Se vuelve a montar con lo escrito cuando el servidor devuelve el formulario con errores.
        key={String(props.defaultValue ?? "")}
        id={id}
        name={name}
        aria-invalid={hasErrors || undefined}
        aria-describedby={hasErrors ? `${id}-error` : description ? `${id}-ayuda` : undefined}
        {...props}
      />
      {description ? <FieldDescription id={`${id}-ayuda`}>{description}</FieldDescription> : null}
      <FieldError id={`${id}-error`} errors={errors?.map((message) => ({ message }))} />
    </Field>
  );
}

/** Opciones excluyentes (radio) con leyenda y errores. */
export function ChoiceField<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  errors,
}: {
  legend: string;
  name: string;
  options: readonly { value: T; label: ReactNode }[];
  value: T | "";
  onChange: (value: T) => void;
  errors?: string[];
}) {
  const hasErrors = Boolean(errors?.length);
  return (
    <fieldset
      role="radiogroup"
      aria-labelledby={`campo-${name}-leyenda`}
      aria-required
      aria-invalid={hasErrors || undefined}
      aria-describedby={hasErrors ? `campo-${name}-error` : undefined}
      className="flex flex-col gap-1"
    >
      <legend id={`campo-${name}-leyenda`} className="mb-1 text-sm font-medium">
        {legend}
      </legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-[15px] hover:bg-muted"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            required
            className="size-4 shrink-0 accent-primary"
          />
          <span>{option.label}</span>
        </label>
      ))}
      <FieldError id={`campo-${name}-error`} errors={errors?.map((message) => ({ message }))} />
    </fieldset>
  );
}

/** Casilla obligatoria que nunca viene marcada (declaraciones bajo protesta). */
export function SwornCheckbox({
  name,
  errors,
  children,
}: {
  name: string;
  errors?: string[];
  children: ReactNode;
}) {
  const hasErrors = Boolean(errors?.length);
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-start gap-3 text-sm leading-snug">
        <input
          type="checkbox"
          name={name}
          required
          className="mt-0.5 size-4 shrink-0 accent-primary"
          aria-invalid={hasErrors || undefined}
          aria-describedby={hasErrors ? `campo-${name}-error` : undefined}
        />
        <span>{children}</span>
      </label>
      <FieldError id={`campo-${name}-error`} errors={errors?.map((message) => ({ message }))} />
    </div>
  );
}
