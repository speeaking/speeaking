import "server-only";
import { siteConfig } from "@/config/site";
import { getFeedPolicy } from "@/modules/platform/settings";
import { hydratePosts } from "@/modules/social/post-queries";
import type { FeedIntentDTO, FeedItemDTO, FeedPageDTO } from "./dto";
import { EMPTY_CONTEXT, loadCandidates, loadViewerContext } from "./queries";
import {
  ALGORITHM_VERSION,
  decodeCursor,
  encodeCursor,
  fitsDeclaredBudget,
  type IntentMatch,
  mixFeed,
  rankCandidates,
} from "./ranking";

/** Explicación para la tarjeta: la búsqueda que coincidió o la categoría que la persona vio. */
function explainIntent(intent: IntentMatch | null, post: FeedItemDTO): FeedIntentDTO | null {
  if (!intent) return null;
  if (intent.basis === "query") {
    return { basis: "query", query: intent.query, source: intent.source };
  }
  return post.product ? { basis: "viewed", categoryName: post.product.categoryName } : null;
}

export type FeedRequest = {
  viewerId: string | null;
  cursor?: string | null;
  limit?: number;
  communityId?: string;
  /**
   * «Siguiendo»: solo publicaciones de las personas que sigue quien ve. Sin sesión, o si no sigue a
   * nadie, la página viene vacía (nunca se rellena con otras publicaciones).
   */
  following?: boolean;
};

/** Piezas por página del feed (el cursor avanza de tanto en tanto). */
export const FEED_PAGE_LIMIT = 10;

const EMPTY_PAGE: FeedPageDTO = { items: [], nextCursor: null };

/**
 * Contrato del motor de recomendación. La implementación v0 es explicable; un modelo de ML
 * (entrenado con las impresiones registradas) podrá reemplazarla sin tocar la interfaz.
 */
export interface RecommendationEngine {
  readonly version: string;
  getFeed(request: FeedRequest): Promise<FeedPageDTO>;
}

class ExplainableRecommendationEngine implements RecommendationEngine {
  readonly version = ALGORITHM_VERSION;

  async getFeed({
    viewerId,
    cursor,
    limit = FEED_PAGE_LIMIT,
    communityId,
    following = false,
  }: FeedRequest): Promise<FeedPageDTO> {
    if (following && !viewerId) return EMPTY_PAGE;
    const decoded = decodeCursor(cursor);
    // `asOf` fija el momento de referencia para que la paginación sea estable.
    const asOf = decoded ? new Date(decoded.asOf) : new Date();
    const offset = decoded?.offset ?? 0;

    const contextPromise = viewerId
      ? loadViewerContext(viewerId, asOf)
      : Promise.resolve(EMPTY_CONTEXT);
    // «Siguiendo» reutiliza a quién sigue la persona (ya viene en su contexto): sin una consulta más.
    const candidatesPromise = following
      ? contextPromise.then(({ followingIds }) =>
          followingIds.size > 0
            ? loadCandidates(asOf, { communityId, authorIds: [...followingIds] })
            : [],
        )
      : loadCandidates(asOf, { communityId });
    // Con experimentos en curso (motor de automejora), quien quedó en el tratamiento ve su variante.
    const [policy, candidates, context] = await Promise.all([
      getFeedPolicy(viewerId),
      candidatesPromise,
      contextPromise,
    ]);
    if (candidates.length === 0) return EMPTY_PAGE;
    const mixed = mixFeed(rankCandidates(candidates, context, policy, asOf), policy);
    const page = mixed.slice(offset, offset + limit);
    const posts = new Map(
      (
        await hydratePosts(
          page.map((item) => item.candidate.id),
          viewerId,
        )
      ).map((post) => [post.id, post]),
    );

    const items: FeedItemDTO[] = page.flatMap((item) => {
      const post = posts.get(item.candidate.id);
      if (!post) return [];
      // El presupuesto declarado está en la moneda del sitio: otra moneda no se compara.
      const withinBudget =
        post.product !== null &&
        post.product.currency === siteConfig.currency &&
        fitsDeclaredBudget(context.intentQueries, {
          categoryId: item.candidate.categoryId,
          productText: item.candidate.productText,
          priceCents: post.product.priceCents,
        });
      return [
        {
          ...post,
          viewer: { ...post.viewer, withinBudget },
          ranking: {
            position: item.position,
            score: Number(item.score.toFixed(4)),
            reason: item.reason,
            slot: item.slot,
            algorithmVersion: this.version,
            intent: explainIntent(item.intent, post),
          },
        },
      ];
    });

    const nextOffset = offset + limit;
    return {
      items,
      nextCursor:
        nextOffset < mixed.length
          ? encodeCursor({ offset: nextOffset, asOf: asOf.getTime() })
          : null,
    };
  }
}

export const recommendationEngine: RecommendationEngine = new ExplainableRecommendationEngine();
