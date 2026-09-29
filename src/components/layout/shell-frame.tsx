"use client";

import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { NAV_COOKIE } from "./nav-cookie";

const NavContext = createContext<{ open: boolean; toggle: () => void }>({
  open: true,
  toggle: () => {},
});

/**
 * Marco de la red social (ADR-046): lleva `data-nav="open|closed"` para que la columna izquierda se
 * pliegue a íconos en escritorio (variante `nav-open:` en `globals.css`). El estado inicial llega
 * del servidor (cookie) para que no haya salto al cargar; el cambio se guarda un año.
 */
export function ShellFrame({
  initialOpen,
  children,
}: {
  initialOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(initialOpen);
  // `data-ready`: React ya tomó la página; hasta entonces el botón de plegar no responde. Se pone
  // directo en el DOM (sin estado) para no repintar todo el marco al montar.
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    frame.current?.setAttribute("data-ready", "true");
  }, []);
  const toggle = () => {
    const next = !open;
    document.cookie = `${NAV_COOKIE}=${next ? "open" : "closed"}; path=/; max-age=31536000; SameSite=Lax`;
    setOpen(next);
  };
  return (
    <NavContext value={{ open, toggle }}>
      <div ref={frame} data-nav={open ? "open" : "closed"} className="flex min-h-dvh flex-col">
        {children}
      </div>
    </NavContext>
  );
}

export function useNav() {
  return useContext(NavContext);
}
