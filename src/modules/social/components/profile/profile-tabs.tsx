"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProfileTab } from "../../profile-copy";

export type ProfileTabItem = { id: ProfileTab; label: string; count?: number; content: ReactNode };

/**
 * Pestañas del perfil (ADR-055): Publicaciones · Fotos · Tienda (solo si vende algo). El contenido
 * llega ya pintado del servidor; aquí solo se cambia de pestaña. `initial` viene de `?ver=`.
 */
export function ProfileTabs({ initial, items }: { initial: ProfileTab; items: ProfileTabItem[] }) {
  return (
    <Tabs defaultValue={initial} className="gap-0">
      <TabsList
        variant="line"
        className="h-auto w-full justify-start gap-0 rounded-none border-b px-2 md:px-0"
      >
        {items.map((item) => (
          <TabsTrigger
            key={item.id}
            value={item.id}
            className="h-11 flex-none gap-1.5 px-3 text-sm font-semibold"
          >
            {item.label}
            {item.count ? (
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                {item.count}
              </span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {items.map((item) => (
        <TabsContent key={item.id} value={item.id} className="pt-3 md:pt-4">
          {item.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
