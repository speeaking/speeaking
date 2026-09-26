import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "../actions";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={signOutAction}>
      <Button
        type="submit"
        variant="ghost"
        size={compact ? "icon" : "default"}
        aria-label="Cerrar sesión"
      >
        <LogOut data-icon={compact ? undefined : "inline-start"} />
        {compact ? null : "Cerrar sesión"}
      </Button>
    </form>
  );
}
