"use client";

import { Search } from "lucide-react";
import Form from "next/form";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { SEARCH_MAX_LENGTH } from "@/modules/search/normalize";
import { parseSearchScope } from "@/modules/search/scopes";

/** ¿La tecla viene de un lugar donde se escribe? Ahí «/» es texto, no un atajo. */
function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Búsqueda global de la barra superior (escritorio). Envía a `/buscar?q=` con navegación del
 * cliente; «/» la enfoca desde cualquier parte de la página y Esc la suelta.
 */
export function SearchBox({ className }: { className?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = pathname === "/buscar" ? (searchParams.get("q") ?? "") : "";
  const scope = pathname === "/buscar" ? parseSearchScope(searchParams.get("tipo")) : "todo";
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.defaultPrevented || isTypingTarget(event.target)) return;
      const input = inputRef.current;
      // Solo si la caja está visible (en móvil la barra superior no la muestra).
      if (!input || input.getClientRects().length === 0) return;
      event.preventDefault();
      input.focus();
      input.select();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Form
      action="/buscar"
      role="search"
      aria-label={`Buscar en ${siteConfig.name}`}
      className={cn(
        "group/search relative flex h-11 items-center gap-2.5 rounded-full border border-transparent bg-secondary pr-2 pl-4 text-muted-foreground transition-colors focus-within:bg-card focus-within:ring-2 focus-within:ring-ring hover:border-line-strong",
        className,
      )}
    >
      <Search className="size-[18px] shrink-0" aria-hidden="true" />
      <label htmlFor="busqueda-global" className="sr-only">
        Buscar personas, comunidades, publicaciones, videos o productos
      </label>
      <input
        // Al cambiar la búsqueda en la URL (atrás/adelante), el campo refleja la nueva.
        key={current}
        ref={inputRef}
        id="busqueda-global"
        name="q"
        type="search"
        defaultValue={current}
        maxLength={SEARCH_MAX_LENGTH}
        placeholder="Busca personas, comunidades o productos"
        autoComplete="off"
        enterKeyHint="search"
        aria-keyshortcuts="/"
        onKeyDown={(event) => {
          if (event.key === "Escape") event.currentTarget.blur();
        }}
        className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
      />
      <input type="hidden" name="tipo" value={scope} />
      <kbd
        aria-hidden="true"
        className="grid h-6 min-w-6 place-items-center rounded-md border border-line-strong px-1.5 font-sans text-xs font-bold text-muted-foreground group-focus-within/search:hidden"
      >
        /
      </kbd>
    </Form>
  );
}
