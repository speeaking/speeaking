import type { ComponentProps } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/** Campo de texto con etiqueta, ayuda y errores accesibles (aria-invalid + aria-describedby). */
export function TextField({
  label,
  description,
  errors,
  id,
  name,
  ...props
}: ComponentProps<typeof Input> & {
  label: string;
  description?: string;
  errors?: string[];
  name: string;
}) {
  const fieldId = id ?? `campo-${name}`;
  const errorId = `${fieldId}-error`;
  const hasErrors = Boolean(errors?.length);

  return (
    <Field data-invalid={hasErrors || undefined}>
      <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
      <Input
        // El valor por omisión solo cambia cuando el servidor devuelve lo escrito tras un envío: el
        // campo se vuelve a montar con él (Base UI avisa si cambia sobre un campo ya iniciado).
        key={String(props.defaultValue ?? "")}
        id={fieldId}
        name={name}
        aria-invalid={hasErrors || undefined}
        aria-describedby={hasErrors ? errorId : undefined}
        className="h-11 text-base"
        {...props}
      />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError id={errorId} errors={errors?.map((message) => ({ message }))} />
    </Field>
  );
}
