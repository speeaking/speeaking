import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link
      href="/"
      className={cn("inline-flex items-center gap-2 rounded-lg", className)}
      aria-label={`${siteConfig.name}, ir al inicio`}
    >
      <BrandMark className="size-8" />
      {compact ? null : (
        <span className="font-heading text-xl font-extrabold tracking-tight">
          {siteConfig.name}
        </span>
      )}
    </Link>
  );
}
