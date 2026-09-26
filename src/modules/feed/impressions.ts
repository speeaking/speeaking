import "server-only";
import type { Surface } from "@/generated/prisma/enums";
import { track } from "@/modules/analytics/track";
import type { FeedItemDTO } from "./dto";

/**
 * Registra una impresión por elemento servido, con posición, puntuación y versión del algoritmo
 * (base para entrenar y evaluar modelos de ranking después, P5).
 */
export function trackImpressions(items: FeedItemDTO[], viewerId: string | null, surface: Surface) {
  if (items.length === 0) return;
  track(
    ...items.map((item) => ({
      type: "IMPRESSION" as const,
      userId: viewerId,
      entityType: "POST" as const,
      entityId: item.id,
      sourcePostId: item.id,
      surface,
      position: item.ranking?.position,
      score: item.ranking?.score,
      algorithmVersion: item.ranking?.algorithmVersion,
      metadata: item.ranking ? { slot: item.ranking.slot, reason: item.ranking.reason } : undefined,
    })),
  );
}
