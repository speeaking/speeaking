import "server-only";
import { cache } from "react";
import { db } from "@/server/db";

/** La comunidad, o `null`. Una sola consulta por petición entre layout, metadatos y página. */
export const getCommunity = cache((slug: string) =>
  db.community.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      emoji: true,
      hue: true,
      description: true,
      memberCount: true,
    },
  }),
);
