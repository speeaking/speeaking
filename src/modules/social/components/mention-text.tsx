import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { mentionsIn } from "../mentions";

/** Texto escapado por React; las menciones abren perfiles con rutas locales. */
export function MentionText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let previous = 0;
  for (const mention of mentionsIn(text)) {
    parts.push(text.slice(previous, mention.start));
    parts.push(
      <Link
        key={mention.start}
        href={`/u/${encodeURIComponent(mention.username)}` as Route}
        className="font-semibold text-primary-text hover:underline"
      >
        {text.slice(mention.start, mention.end)}
      </Link>,
    );
    previous = mention.end;
  }
  parts.push(text.slice(previous));
  return <>{parts}</>;
}
