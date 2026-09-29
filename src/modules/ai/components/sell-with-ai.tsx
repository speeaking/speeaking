import { PenLine } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { aiAvailability } from "../tasks/availability";
import { PUBLISH_BY_HAND } from "../tasks/simulation";
import { SellWithAiForm } from "./sell-with-ai-form";

/**
 * «Sube y vende». Componente de servidor: con la IA simulada en un piloto marca la propuesta como
 * ejemplo; sin IA disponible (ADR-038) no ofrece generar plantillas: invita a publicar a mano.
 */
export async function SellWithAi() {
  const availability = await aiAvailability("sale_proposal");
  if (availability === "unavailable") return <WriteByHand />;
  return <SellWithAiForm simulated={availability === "simulated"} />;
}

export function WriteByHand() {
  return (
    <section
      role="status"
      className="flex flex-col gap-3 rounded-3xl border bg-card p-5 text-foreground"
    >
      <h2 className="font-heading text-2xl leading-tight font-extrabold">{PUBLISH_BY_HAND}</h2>
      <p className="text-sm text-muted-foreground">
        La IA no está disponible en este momento. Publica tu producto con tus palabras: tu ganancia
        por pieza se calcula igual con tu precio y tu costo.
      </p>
      <Link href="/studio/productos/nuevo" className={buttonVariants({ className: "self-start" })}>
        <PenLine data-icon="inline-start" />
        Publicar a mano
      </Link>
    </section>
  );
}
