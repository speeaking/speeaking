import { MessageCircleQuestionMark } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { formatCount } from "@/lib/format";
import type { OpenDebatesDTO } from "../dto";
import { RailSection } from "./rail-section";

/**
 * «Debates abiertos»: hasta 4 preguntas recientes, numeradas en el color de su comunidad. Los
 * contadores son reales y los ceros no se muestran: si ninguna tiene respuestas, UNA invitación.
 */
export function OpenDebates({ debates, signedIn }: { debates: OpenDebatesDTO; signedIn: boolean }) {
  if (debates.items.length === 0) {
    // Sin preguntas abiertas (ni en tus comunidades ni en las demás) no se inventa nada: a quien
    // tiene sesión se le invita a hacer una.
    return signedIn ? (
      <RailSection id="columna-debates" title="Debates abiertos" icon={MessageCircleQuestionMark}>
        <p className="text-sm leading-snug text-ink-2">
          Por ahora nadie tiene una pregunta abierta.{" "}
          <Link
            href="/crear/publicacion"
            className="font-semibold text-primary-text underline-offset-2 hover:underline"
          >
            Haz la primera
          </Link>
        </p>
      </RailSection>
    ) : null;
  }

  return (
    <RailSection
      id="columna-debates"
      title="Debates abiertos"
      icon={MessageCircleQuestionMark}
      description={
        debates.scope === "yours"
          ? "Preguntas de tus comunidades que esperan tu opinión."
          : signedIn
            ? "Preguntas de las comunidades que esperan tu opinión."
            : "Preguntas de las comunidades que esperan una respuesta."
      }
    >
      <ol className="flex flex-col">
        {debates.items.map((debate, index) => (
          <li
            key={debate.id}
            style={{ "--hue": debate.community.hue } as CSSProperties}
            className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-2.5 border-t py-2.5 first:border-t-0 first:pt-0 last:pb-0"
          >
            <span
              aria-hidden="true"
              className="font-heading text-[28px] leading-none font-extrabold tracking-display community-text tabular-nums"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <Link
                href={`/p/${debate.id}` as Route}
                className="line-clamp-3 text-sm leading-snug font-semibold break-words hover:underline"
              >
                {debate.text}
              </Link>
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                <Link
                  href={`/c/${debate.community.slug}` as Route}
                  className="font-bold community-text hover:underline"
                >
                  <span aria-hidden="true">{debate.community.emoji}</span> {debate.community.name}
                </Link>
                {debate.comments > 0 ? (
                  <span>· {formatCount(debate.comments, "respuesta", "respuestas")}</span>
                ) : null}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {debates.anyAnswered ? null : (
        <p className="mt-3 rounded-2xl bg-secondary px-3 py-2 text-xs leading-snug font-medium text-ink-2">
          Aún nadie responde: la primera opinión puede ser la tuya.
        </p>
      )}
    </RailSection>
  );
}
