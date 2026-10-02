"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import Link from "next/link";
import type { ReactElement } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CREATE_OPTIONS } from "@/config/create-options";
import { preventLinkNavigation } from "./inbox-surface";

/**
 * «Crear» abre sus opciones ahí mismo (ADR-068), como el «+» de Facebook: sin salir de la página.
 * «Publicación» abre la ventana para escribir encima de lo que estabas viendo; vender lleva al Studio.
 */
export function CreateMenu({
  trigger,
  side = "bottom",
  align = "end",
}: {
  /** El enlace a /crear que lo abre: antes de que cargue la página lleva ahí; después, abre el menú. */
  trigger: ReactElement;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger nativeButton={false} render={trigger} onClick={preventLinkNavigation} />
      <DropdownMenuContent
        side={side}
        align={align}
        sideOffset={10}
        className="w-[min(22rem,calc(100vw-1rem))] rounded-2xl p-1.5"
      >
        <p className="px-2.5 pt-1.5 pb-2 font-heading text-base font-bold">Crear</p>
        {CREATE_OPTIONS.map(({ href, title, description, icon: Icon }) => (
          <MenuPrimitive.LinkItem
            key={href}
            closeOnClick
            render={<Link href={href} />}
            className="flex items-center gap-3 rounded-xl px-2.5 py-2 outline-none select-none focus:bg-accent data-highlighted:bg-accent"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-ink-2">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[15px] font-semibold text-foreground">{title}</span>
              <span className="text-xs leading-snug text-muted-foreground">{description}</span>
            </span>
          </MenuPrimitive.LinkItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
