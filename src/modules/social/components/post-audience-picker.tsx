"use client";

import { ChevronDown, Globe, LockKeyhole, Users } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AUDIENCE_OPTIONS, POST_AUDIENCES, type PostAudienceValue } from "../audience";

export function AudienceIcon({
  value,
  className = "size-4",
}: {
  value: PostAudienceValue;
  className?: string;
}) {
  const Icon = value === "PUBLIC" ? Globe : value === "FRIENDS" ? Users : LockKeyhole;
  return <Icon className={className} aria-hidden="true" />;
}

export function AudienceOptions({
  value,
  onChange,
  disabled = false,
}: {
  value: PostAudienceValue;
  onChange: (value: PostAudienceValue) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <fieldset disabled={disabled} className="flex flex-col gap-2">
      <legend className="sr-only">Quién puede ver esta publicación</legend>
      {POST_AUDIENCES.map((option) => (
        <label
          key={option}
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent p-3 transition-colors hover:bg-accent has-checked:border-primary/40 has-checked:bg-primary/5 has-disabled:opacity-60"
        >
          <AudienceIcon value={option} className="size-5 shrink-0 text-muted-foreground" />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-semibold">{AUDIENCE_OPTIONS[option].label}</span>
            <span className="text-xs leading-relaxed text-muted-foreground">
              {AUDIENCE_OPTIONS[option].description}
            </span>
          </span>
          <input
            type="radio"
            name={id}
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
            className="size-4 shrink-0 accent-primary"
          />
        </label>
      ))}
    </fieldset>
  );
}

/** Selector compacto: cambia el borrador solo al confirmar en la ventana. */
export function PostAudiencePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: PostAudienceValue;
  onChange: (value: PostAudienceValue) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full"
        disabled={disabled}
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
        aria-label={"Cambiar audiencia: " + AUDIENCE_OPTIONS[value].label}
      >
        <AudienceIcon value={value} />
        {AUDIENCE_OPTIONS[value].label}
        <ChevronDown className="size-3" aria-hidden="true" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Quién puede ver tu publicación?</DialogTitle>
            <DialogDescription>
              Esta elección se aplica al texto, las fotos, el video y sus comentarios.
            </DialogDescription>
          </DialogHeader>
          <AudienceOptions value={draft} onChange={setDraft} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              Listo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
