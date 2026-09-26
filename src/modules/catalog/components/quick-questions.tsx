"use client";

import { MessageCircleQuestion } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  answerQuickQuestion,
  type ProductFacts,
  QUICK_QUESTIONS,
  type QuickQuestionId,
} from "../quick-answers";

/** Preguntas rápidas con respuesta instantánea desde datos verificables (P4). */
export function QuickQuestions({ facts }: { facts: ProductFacts }) {
  const [selected, setSelected] = useState<QuickQuestionId | null>(null);

  return (
    <section aria-labelledby="preguntas-rapidas" className="flex flex-col gap-3">
      <h2 id="preguntas-rapidas" className="flex items-center gap-2 text-lg font-bold">
        <MessageCircleQuestion className="size-5" />
        Pregunta al instante
      </h2>
      <div className="-mx-4 scrollbar-none flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        {QUICK_QUESTIONS.map((question) => (
          <button
            key={question.id}
            type="button"
            aria-pressed={selected === question.id}
            onClick={() => setSelected(question.id)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
              selected === question.id
                ? "border-foreground bg-foreground text-background"
                : "bg-card hover:bg-secondary",
            )}
          >
            {question.label}
          </button>
        ))}
      </div>
      <p
        role="status"
        aria-live="polite"
        className={cn("rounded-2xl bg-secondary px-4 py-3 text-[15px]", !selected && "sr-only")}
      >
        {selected ? answerQuickQuestion(selected, facts) : ""}
      </p>
      {selected ? (
        <p className="text-xs text-muted-foreground">
          Respuesta automática con los datos que publicó el vendedor.
        </p>
      ) : null}
    </section>
  );
}
