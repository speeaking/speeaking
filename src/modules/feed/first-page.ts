import "server-only";
import { cache } from "react";
import type { FeedPageDTO } from "./dto";
import { recommendationEngine } from "./engine";

/**
 * Primera página de «Para ti», una sola vez por request. La usan la página de inicio y la columna
 * derecha («Lo que buscas»), que así no repite un producto que el feed ya muestra (regla del
 * presupuesto comercial del rediseño). El argumento es un primitivo a propósito: `cache` compara por
 * identidad, y un objeto nuevo en cada llamada nunca coincidiría.
 */
export const getHomeFirstPage = cache((viewerId: string | null): Promise<FeedPageDTO> =>
  recommendationEngine.getFeed({ viewerId }),
);
