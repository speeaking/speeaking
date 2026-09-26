"use client";

import { Eye, EyeOff } from "lucide-react";
import { type ComponentProps, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Campo de contraseña con el mismo aspecto y API que TextField, más un botón para ver lo que
 * escribes (sobre todo en el celular). El nombre del botón va como texto oculto y no como
 * aria-label, para que la etiqueta del campo siga siendo la única que lo identifica.
 */
export function PasswordField({
  label,
  description,
  errors,
  id,
  name,
  className,
  ...props
}: Omit<ComponentProps<typeof Input>, "type"> & {
  label: string;
  description?: string;
  errors?: string[];
  name: string;
}) {
  const [visible, setVisible] = useState(false);
  const fieldId = id ?? `campo-${name}`;
  const errorId = `${fieldId}-error`;
  const hasErrors = Boolean(errors?.length);
  const Icon = visible ? EyeOff : Eye;

  return (
    <Field data-invalid={hasErrors || undefined}>
      <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
      <div className="relative">
        <Input
          id={fieldId}
          name={name}
          type={visible ? "text" : "password"}
          aria-invalid={hasErrors || undefined}
          aria-describedby={hasErrors ? errorId : undefined}
          className={cn("h-11 pr-12 text-base", className)}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-pressed={visible}
          aria-controls={fieldId}
          onClick={() => setVisible((current) => !current)}
          className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
        >
          <Icon aria-hidden="true" />
          <span className="sr-only">Mostrar contraseña</span>
        </Button>
      </div>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError id={errorId} errors={errors?.map((message) => ({ message }))} />
    </Field>
  );
}
