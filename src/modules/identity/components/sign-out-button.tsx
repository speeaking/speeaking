import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { signOutAction } from "../actions";

/**
 * Cerrar sesión. `compact`: solo el ícono. `collapseOnDesktop`: en escritorio queda en ícono (el
 * menú del avatar de la barra de arriba ya lo ofrece con su texto); en teléfono, con texto.
 */
export function SignOutButton({
  compact = false,
  collapseOnDesktop = false,
}: {
  compact?: boolean;
  collapseOnDesktop?: boolean;
}) {
  return (
    <form action={signOutAction}>
      <Button
        type="submit"
        variant="ghost"
        size={compact ? "icon" : "default"}
        aria-label="Cerrar sesión"
        className={cn(collapseOnDesktop && "lg:size-9 lg:px-0")}
      >
        <LogOut data-icon={compact ? undefined : "inline-start"} />
        {compact ? null : (
          <span className={cn(collapseOnDesktop && "lg:sr-only")}>Cerrar sesión</span>
        )}
      </Button>
    </form>
  );
}
