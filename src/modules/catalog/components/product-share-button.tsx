"use client";

import { ShareButton } from "@/components/share-button";
import { recordProductShareAction } from "../share-actions";

export function ProductShareButton({
  productId,
  slug,
  title,
  text,
  label,
  variant,
}: {
  productId: string;
  slug: string;
  title: string;
  text?: string;
  label?: string;
  variant?: "outline" | "default";
}) {
  return (
    <ShareButton
      path={`/producto/${slug}`}
      title={title}
      text={text}
      label={label}
      variant={variant}
      onShared={(channel) => void recordProductShareAction(productId, channel)}
    />
  );
}
