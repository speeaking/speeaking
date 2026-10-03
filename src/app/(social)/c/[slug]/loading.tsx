import { FeedSkeleton } from "@/components/states/feed-skeleton";

/** El feed de la comunidad mientras carga. Va dentro del layout, que ya comprobó que existe. */
export default function Loading() {
  return <FeedSkeleton />;
}
