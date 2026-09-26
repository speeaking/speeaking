"use client";

import { X } from "lucide-react";
import { createContext, type ReactNode, use, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { dismissIntentAction } from "../actions";

const DismissIntentContext = createContext<{ dismiss: () => void; pending: boolean } | null>(null);

/**
 * Envuelve «Lo que buscas» para poder descartarla («Ya no busco esto»). Se oculta al instante; si
 * el servidor la rechaza, vuelve a aparecer con un aviso. El botón va dentro del bloque
 * (`DismissIntentButton`), junto al título.
 */
export function DismissibleIntent({
  intentId,
  children,
}: {
  intentId: string;
  children: ReactNode;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [hidden, setHidden] = useOptimistic(dismissed);
  const [pending, startTransition] = useTransition();

  if (hidden) return null;

  const dismiss = () =>
    startTransition(async () => {
      setHidden(true);
      const result = await dismissIntentAction(intentId);
      if (result.ok) setDismissed(true);
      else toast.error(result.error);
    });

  return <DismissIntentContext value={{ dismiss, pending }}>{children}</DismissIntentContext>;
}

export function DismissIntentButton({ query }: { query: string }) {
  const context = use(DismissIntentContext);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="-mr-1.5 text-muted-foreground"
      aria-label={`Ya no busco «${query}»`}
      disabled={!context || context.pending}
      onClick={context?.dismiss}
    >
      <X />
    </Button>
  );
}
