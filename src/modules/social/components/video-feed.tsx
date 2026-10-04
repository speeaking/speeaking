"use client";

import { Clapperboard, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VideoPage } from "../video-queries";
import { PostCard } from "./post-card";

export function VideoFeed({
  initialPage,
  isSignedIn,
}: {
  initialPage: VideoPage;
  isSignedIn: boolean;
}) {
  const [items, setItems] = useState(initialPage.items);
  const [cursor, setCursor] = useState(initialPage.nextCursor);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const request = useRef<AbortController | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    request.current?.abort();
    request.current = null;
    setItems(initialPage.items);
    setCursor(initialPage.nextCursor);
    setStatus("idle");
    return () => {
      request.current?.abort();
    };
  }, [initialPage]);

  const loadMore = useCallback(async () => {
    if (!cursor || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setStatus("loading");
    try {
      const response = await fetch(`/api/videos?${new URLSearchParams({ cursor })}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error();
      const page = (await response.json()) as VideoPage;
      if (controller.signal.aborted) return;
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !seen.has(item.id))];
      });
      setCursor(page.nextCursor);
      setStatus("idle");
    } catch {
      if (!controller.signal.aborted) setStatus("error");
    } finally {
      if (request.current === controller) request.current = null;
    }
  }, [cursor]);

  useEffect(() => {
    if (
      !cursor ||
      status !== "idle" ||
      !sentinel.current ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void loadMore();
      },
      { rootMargin: "300px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [cursor, loadMore, status]);

  if (!items.length && !cursor)
    return (
      <div className="px-4 md:px-0">
        <EmptyState
          icon={Clapperboard}
          title="Los primeros reels están por llegar"
          description="Aquí aparecen los videos públicos y los de tus amigos aceptados. Comparte uno para comenzar la conversación."
          action={
            <Link href="/crear/publicacion?tipo=video" scroll={false} className={buttonVariants()}>
              Compartir video
            </Link>
          }
        />
      </div>
    );
  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Videos de la comunidad" className="flex flex-col gap-4">
        {items.map((post, index) => (
          <PostCard key={post.id} post={post} index={index} reel isSignedIn={isSignedIn} />
        ))}
      </section>
      <div
        ref={sentinel}
        className="flex min-h-16 flex-col items-center justify-center gap-2 px-4"
        aria-live="polite"
      >
        {status === "loading" ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Cargando videos…
          </p>
        ) : null}
        {status === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            No pudimos cargar más videos.
          </p>
        ) : null}
        {cursor && status !== "loading" ? (
          <Button variant="outline" onClick={() => void loadMore()}>
            {status === "error" ? "Reintentar" : "Ver más videos"}
          </Button>
        ) : null}
        {!cursor ? (
          <p className="text-sm text-muted-foreground">Ya viste los videos disponibles.</p>
        ) : null}
      </div>
    </div>
  );
}
