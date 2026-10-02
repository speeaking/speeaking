"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import {
  Bell,
  CircleUser,
  LogOut,
  type LucideIcon,
  MessageCircle,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { Suspense, useCallback, useState, useTransition } from "react";
import { Logo } from "@/components/brand/logo";
import { UserAvatar } from "@/components/brand/user-avatar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { shellGrid, shellMain } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/modules/identity/actions";
import type { ViewerSummary } from "@/modules/identity/viewer-summary";
import { MessagesPanel } from "@/modules/messages/components/messages-panel";
import { NotificationsPanel } from "@/modules/notifications/components/notifications-panel";
import { CreateMenu } from "./create-menu";
import { SearchBox } from "./search-box";

type Viewer = NonNullable<ViewerSummary>;

/** Íconos de la barra móvil: 44 px, el mínimo cómodo para el dedo. */
const mobileIcon = buttonVariants({ variant: "ghost", size: "icon-lg", className: "size-11" });

/** El globo con el número (carrito, avisos y mensajes). */
function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-none font-bold text-primary-foreground ring-2 ring-background"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

const iconButton = buttonVariants({ variant: "ghost", size: "icon-lg", className: "relative" });

/** Carrito con su número de piezas. El nombre accesible empieza con «Carrito» e incluye el número. */
function CartLink({ count, className }: { count: number; className?: string }) {
  return (
    <Link href="/carrito" aria-label={`Carrito (${count})`} className={cn(iconButton, className)}>
      <ShoppingCart className="size-5" />
      <CountBadge count={count} />
    </Link>
  );
}

/** Lo que la barra cuenta sin leer; baja ahí mismo al abrir los recuadros (ADR-068). */
type Unread = { notifications: number; messages: number };

function unreadOf(viewer: ViewerSummary): Unread {
  return {
    notifications: viewer?.unreadNotifications ?? 0,
    messages: viewer?.unreadMessages ?? 0,
  };
}

/**
 * La campana (ADR-059) y los mensajes (ADR-047) abren su recuadro ahí mismo (ADR-068): en
 * escritorio bajo el botón y en teléfono como panel desde abajo. Las páginas /avisos y /mensajes
 * siguen para verlo todo.
 */
function InboxButtons({
  unread,
  onNotificationsSeen,
  onConversationRead,
  className,
}: {
  unread: Unread;
  onNotificationsSeen: () => void;
  onConversationRead: () => void;
  className?: string;
}) {
  const bell = unread.notifications > 0 ? `Avisos (${unread.notifications} sin leer)` : "Avisos";
  const chat = unread.messages > 0 ? `Mensajes (${unread.messages} sin leer)` : "Mensajes";
  return (
    <>
      <NotificationsPanel
        onSeen={onNotificationsSeen}
        trigger={
          <Link href="/avisos" aria-label={bell} title={bell} className={cn(iconButton, className)}>
            <Bell
              className={cn(
                "size-5",
                unread.notifications > 0 && "motion-safe:animate-[bell-ring_1s_ease-in-out_1]",
              )}
            />
            <CountBadge count={unread.notifications} />
          </Link>
        }
      />
      <MessagesPanel
        onRead={onConversationRead}
        trigger={
          <Link
            href="/mensajes"
            aria-label={chat}
            title={chat}
            className={cn(iconButton, className)}
          >
            <MessageCircle className="size-5" />
            <CountBadge count={unread.messages} />
          </Link>
        }
      />
    </>
  );
}

const menuItemClass =
  "flex h-9 items-center gap-2.5 rounded-md px-2 text-sm font-medium outline-none select-none focus:bg-accent focus:text-accent-foreground data-highlighted:bg-accent [&_svg]:size-4 [&_svg]:text-muted-foreground";

function MenuLink({
  href,
  icon: Icon,
  children,
}: {
  href: Route;
  icon: LucideIcon;
  children: string;
}) {
  return (
    <MenuPrimitive.LinkItem closeOnClick render={<Link href={href} />} className={menuItemClass}>
      <Icon />
      {children}
    </MenuPrimitive.LinkItem>
  );
}

/** Menú del avatar: perfil, pedidos, ajustes, Administración (solo el equipo) y cerrar sesión. */
function AccountMenu({ viewer }: { viewer: Viewer }) {
  const [signingOut, startSignOut] = useTransition();
  const seed = viewer.username ?? viewer.displayName;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Tu cuenta: ${viewer.displayName}`}
        className="ml-1 grid size-10 place-items-center rounded-full ring-1 ring-line-strong ring-offset-2 ring-offset-card outline-none focus-visible:ring-2 focus-visible:ring-ring data-popup-open:ring-2 data-popup-open:ring-ring"
      >
        <UserAvatar
          name={viewer.displayName}
          seed={seed}
          src={viewer.avatarUrl}
          className="size-10"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-64 rounded-2xl p-1.5">
        <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-2.5">
          <UserAvatar
            name={viewer.displayName}
            seed={seed}
            src={viewer.avatarUrl}
            className="size-9"
          />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-bold text-foreground">{viewer.displayName}</span>
            {viewer.username ? (
              <span className="truncate text-xs text-muted-foreground">@{viewer.username}</span>
            ) : null}
          </span>
        </div>
        <DropdownMenuSeparator />
        <MenuLink href="/perfil" icon={CircleUser}>
          Perfil
        </MenuLink>
        <MenuLink href="/mensajes" icon={MessageCircle}>
          Mensajes
        </MenuLink>
        <MenuLink href="/pedidos" icon={ReceiptText}>
          Mis pedidos
        </MenuLink>
        <MenuLink href="/ajustes" icon={Settings}>
          Ajustes
        </MenuLink>
        {/* Solo el equipo (ADMIN): a los demás ni la llave les llega (`getViewerSummary`). */}
        {viewer.isAdmin ? (
          <MenuLink href="/admin/resumen" icon={ShieldCheck}>
            Administración
          </MenuLink>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={menuItemClass}
          disabled={signingOut}
          onClick={() => startSignOut(() => signOutAction())}
        >
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Barra superior. Móvil: logo, lupa (→ /buscar), tema, campana, mensajes y carrito (o «Únete»).
 * Escritorio: sobre la misma rejilla que el contenido, logo · búsqueda · «Crear», campana, mensajes,
 * carrito y avatar (o «Entrar» y «Crear cuenta»). La campana de avisos llegó con ADR-059; «Crear»,
 * la campana y los mensajes abren ahí mismo desde ADR-068.
 */
export function TopBar({ viewer }: { viewer: ViewerSummary }) {
  // Los números llegan del servidor en cada navegación; al leer en un recuadro bajan ahí mismo, sin
  // recargar la página de atrás (así no se pierde dónde ibas en el feed).
  const [unread, setUnread] = useState<Unread>(() => unreadOf(viewer));
  const [source, setSource] = useState(viewer);
  if (source !== viewer) {
    setSource(viewer);
    setUnread(unreadOf(viewer));
  }
  const onNotificationsSeen = useCallback(
    () => setUnread((current) => ({ ...current, notifications: 0 })),
    [],
  );
  const onConversationRead = useCallback(
    () => setUnread((current) => ({ ...current, messages: Math.max(0, current.messages - 1) })),
    [],
  );

  return (
    // La línea inferior es una sombra, no un borde: así la barra mide 64 px justos y las columnas
    // sticky (top-16) empiezan exactamente debajo, sin un píxel cortado al final.
    <header className="sticky top-0 z-30 bg-glass shadow-[0_1px_0_var(--color-border)] backdrop-blur-xl backdrop-saturate-150">
      <div className="flex h-14 items-center justify-between pr-2 pl-4 md:hidden">
        <Logo className="py-1.5" />
        <div className="flex items-center">
          <Link href="/buscar" aria-label="Buscar" className={mobileIcon}>
            <Search className="size-5" />
          </Link>
          {/* El único lugar del tema en móvil; su botón crece a 44 px como los demás íconos. */}
          <span className="contents [&>button]:size-11">
            <ThemeToggle />
          </span>
          {viewer ? (
            <>
              <InboxButtons
                unread={unread}
                onNotificationsSeen={onNotificationsSeen}
                onConversationRead={onConversationRead}
                className="size-11"
              />
              <CartLink count={viewer.cartCount} className="size-11" />
            </>
          ) : (
            <Link
              href="/registro"
              // Se ve de 36 px, pero el área táctil llega a 44 px (after).
              className={buttonVariants({
                className:
                  "relative mr-2 ml-1.5 h-9 px-3.5 text-sm font-bold after:absolute after:inset-x-0 after:-inset-y-1",
              })}
            >
              Únete
            </Link>
          )}
        </div>
      </div>

      <div className={cn(shellGrid, "hidden h-16 items-center md:grid")}>
        <Logo className="justify-self-center nav-open:justify-self-start [&>span]:hidden nav-open:[&>span]:inline" />
        {/* En xl este contenedor desaparece y sus hijos ocupan las columnas 2 y 3 de la rejilla. */}
        <div className="flex min-w-0 items-center gap-3 xl:contents">
          <Suspense fallback={<div className="h-11 min-w-0 flex-1 rounded-full bg-secondary" />}>
            <SearchBox className={cn("min-w-0 flex-1", shellMain)} />
          </Suspense>
          <div className="flex shrink-0 items-center justify-end gap-1">
            {viewer ? (
              <>
                <CreateMenu
                  trigger={
                    <Link
                      href="/crear"
                      className={buttonVariants({
                        className: "mr-1.5 h-10 gap-1.5 px-4 text-[15px] font-bold",
                      })}
                    >
                      <Plus className="size-[18px]" strokeWidth={2.6} />
                      Crear
                    </Link>
                  }
                />
                <InboxButtons
                  unread={unread}
                  onNotificationsSeen={onNotificationsSeen}
                  onConversationRead={onConversationRead}
                />
                <CartLink count={viewer.cartCount} />
                <AccountMenu viewer={viewer} />
              </>
            ) : (
              <>
                <Link
                  href="/entrar"
                  className={buttonVariants({
                    variant: "ghost",
                    className: "h-10 px-3.5 text-[15px] font-bold",
                  })}
                >
                  Entrar
                </Link>
                {/* Contorno (ADR-042): la bienvenida de la columna derecha ya lleva el botón rosa. */}
                <Link
                  href="/registro"
                  className={buttonVariants({
                    variant: "outline",
                    className: "h-10 px-4 text-[15px] font-bold",
                  })}
                >
                  Crear cuenta
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
