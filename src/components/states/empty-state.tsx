import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Estado vacío: explica qué pasará aquí y ofrece el siguiente paso. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col items-center gap-3 rounded-3xl border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      <span className="grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
        <Icon className="size-7" />
      </span>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </section>
  );
}
