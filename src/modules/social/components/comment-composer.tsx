import type { Route } from "next";
import Link from "next/link";
import { joinHref } from "@/modules/feed/components/join-prompt";
import type { FeedItemDTO } from "@/modules/feed/dto";
import { CommentForm } from "./comment-form";

/** Enlace de texto con 44 px al tacto sin mover la línea. */
const inlineLink = "-my-3 inline-block py-3 font-semibold text-foreground underline";

/**
 * Lo que va donde se comenta, según quién mira: el formulario con sesión y perfil; «Termina tu
 * perfil» con sesión pero sin perfil (decir «Entra» sería falso); y crear cuenta o entrar a quien
 * visita. Lo usan la página de la publicación y el panel de comentarios (ADR-057).
 */
export function CommentComposer({
  post,
  viewer,
  variant = "page",
  anchorId,
}: {
  post: Pick<FeedItemDTO, "id" | "community">;
  viewer: { onboarded: boolean } | null;
  variant?: "page" | "panel";
  /** `#comentar` en la página: destino de «¿Qué opinas?» y del ícono de comentar. */
  anchorId?: string;
}) {
  const postPath = `/p/${post.id}`;
  if (viewer?.onboarded) return <CommentForm postId={post.id} id={anchorId} variant={variant} />;
  if (viewer) {
    // Terminar el perfil y volver aquí, con la comunidad de la publicación ya marcada.
    const params = new URLSearchParams({ next: postPath });
    if (post.community) params.set("unirse", post.community.slug);
    return (
      <p id={anchorId} className="scroll-mt-24 text-sm text-muted-foreground">
        <Link href={`/bienvenida?${params}` as Route} className={inlineLink}>
          Termina tu perfil para comentar
        </Link>
      </p>
    );
  }
  return (
    <p id={anchorId} className="scroll-mt-24 text-sm text-muted-foreground">
      <Link href={joinHref(postPath, post.community)} className={inlineLink}>
        Crea tu cuenta gratis
      </Link>{" "}
      para comentar. ¿Ya tienes cuenta?{" "}
      <Link
        href={`/entrar?next=${encodeURIComponent(postPath)}` as Route}
        // Palabra corta: también 44 px de ancho al tacto.
        className={`${inlineLink} -mx-1.5 px-1.5`}
      >
        Entra
      </Link>
    </p>
  );
}
