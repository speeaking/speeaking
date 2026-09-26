import { Compass } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="contenido" className="mx-auto flex min-h-dvh max-w-xl items-center px-4">
      <EmptyState
        className="w-full"
        icon={Compass}
        title="No encontramos esta página"
        description="Puede que el enlace esté mal escrito o que el contenido ya no exista."
        action={
          <Link href="/" className={buttonVariants()}>
            Ir al inicio
          </Link>
        }
      />
    </main>
  );
}
