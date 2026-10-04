import type { FeedItemDTO, FeedVideoDTO } from "./dto";
import type { FeedProductItemDTO, FeedProductsDTO } from "./product-carousel-compose";

export type HomeVideoReelDTO = {
  kind: "video";
  postId: string;
  caption: string;
  author: FeedItemDTO["author"];
  audience: "friends" | "public";
  video: FeedVideoDTO;
  platformUpdate: boolean;
};
export type HomeReelDTO = HomeVideoReelDTO | ({ kind: "product" } & FeedProductItemDTO);
export type HomeReelsDTO = {
  items: HomeReelDTO[];
  productHref: string;
  productReason: string;
};

/** Alterna videos y productos sin duplicar piezas ni inventar contenido para llenar la fila. */
export function composeHomeReels(
  products: FeedProductsDTO | null,
  posts: readonly FeedItemDTO[],
  platformUpdateId: string | null,
): HomeReelsDTO {
  const videos: HomeVideoReelDTO[] = [];
  const seen = new Set<string>();
  for (const post of posts) {
    if (!post.video || seen.has(post.id)) continue;
    seen.add(post.id);
    const text = post.body.replace(/\s+/g, " ").trim();
    videos.push({
      kind: "video",
      postId: post.id,
      caption: text.length > 110 ? `${text.slice(0, 109).trimEnd()}…` : text,
      author: post.author,
      audience: post.audience ?? "friends",
      video: post.video,
      platformUpdate: post.id === platformUpdateId,
    });
  }
  const merchandise = products?.items ?? [];
  const items: HomeReelDTO[] = [];
  for (let index = 0; index < Math.max(videos.length, merchandise.length); index++) {
    const video = videos[index];
    const product = merchandise[index];
    if (video) items.push(video);
    if (product) items.push({ kind: "product", ...product });
  }
  return {
    items,
    productHref: products?.href ?? "/comprar",
    productReason: products?.reason ?? "",
  };
}
