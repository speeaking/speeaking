import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedItemDTO } from "../dto";
import { FeedList } from "./feed-list";
import { useVisibleImpressions } from "./use-visible-impressions";
import { FLUSH_INTERVAL_MS, type ImpressionTransport } from "./visible-impressions";

vi.mock("@/modules/social/actions", () => ({
  reactAction: vi.fn(),
  toggleSaveAction: vi.fn(),
}));
vi.mock("@/modules/social/context-actions", () => ({ getPostContextAction: vi.fn() }));
vi.mock("@/modules/social/interaction-actions", () => ({ recordShareAction: vi.fn() }));
vi.mock("@/modules/social/post-text-actions", () => ({ getPostTextAction: vi.fn() }));
vi.mock("@/modules/social/delete-post-action", () => ({ deletePostAction: vi.fn() }));
vi.mock("@/modules/social/audience-actions", () => ({ changePostAudienceAction: vi.fn() }));
vi.mock("@/modules/voice/actions", () => ({
  interpretVoiceAction: vi.fn(),
  findVoiceFriendsAction: vi.fn(),
  prepareVoiceShareAction: vi.fn(),
  confirmVoiceShareAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));

type Entry = { target: Element; isIntersecting: boolean; intersectionRatio: number };

/** Observadores creados (jsdom no trae IntersectionObserver): se simula qué entra en pantalla. */
let observers: { callback: (entries: Entry[]) => void; elements: Set<Element> }[] = [];
let visibility: DocumentVisibilityState = "visible";

beforeEach(() => {
  vi.useFakeTimers();
  observers = [];
  visibility = "visible";
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      private readonly record: (typeof observers)[number];
      constructor(callback: (entries: Entry[]) => void) {
        this.record = { callback, elements: new Set() };
        observers.push(this.record);
      }
      observe(element: Element) {
        this.record.elements.add(element);
      }
      unobserve(element: Element) {
        this.record.elements.delete(element);
      }
      disconnect() {
        this.record.elements.clear();
      }
    },
  );
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const POST_A = "0199a000-0000-7000-8000-0000000000a1";
const POST_B = "0199a000-0000-7000-8000-0000000000a2";

/** Muestra (o esconde) una pieza con la fracción dada a TODOS los observadores que la miran. */
function show(postId: string, ratio: number) {
  const element = document.querySelector(`[data-impression-post="${postId}"]`);
  if (!element) throw new Error(`No hay pieza ${postId}`);
  act(() => {
    for (const observer of observers) {
      if (!observer.elements.has(element)) continue;
      observer.callback([{ target: element, isIntersecting: ratio > 0, intersectionRatio: ratio }]);
    }
  });
}

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function Cards({
  transport,
  surface = "FEED",
}: {
  transport: ImpressionTransport;
  surface?: "FEED" | "COMMUNITY";
}) {
  const observe = useVisibleImpressions(surface, transport);
  return (
    <>
      <div ref={observe} data-impression-post={POST_A} data-impression-position={0} />
      <div ref={observe} data-impression-post={POST_B} data-impression-position={1} />
    </>
  );
}

describe("useVisibleImpressions (T5)", () => {
  it("una pieza a la mitad en pantalla 1 s cuenta; un destello de 200 ms no; se manda a los 5 s", () => {
    const transport = vi.fn<ImpressionTransport>();
    render(<Cards transport={transport} surface="COMMUNITY" />);

    show(POST_B, 0.8);
    advance(200);
    show(POST_B, 0);

    show(POST_A, 0.6);
    advance(1_000);
    expect(transport).not.toHaveBeenCalled();
    advance(FLUSH_INTERVAL_MS);
    expect(transport).toHaveBeenCalledExactlyOnceWith(
      [{ postId: POST_A, surface: "COMMUNITY", position: 0 }],
      "fetch",
    );

    // Otra vez en pantalla: una vez por pieza y vista de la página.
    show(POST_A, 0);
    show(POST_A, 1);
    advance(FLUSH_INTERVAL_MS * 2);
    expect(transport).toHaveBeenCalledOnce();
  });

  it("menos de la mitad no cuenta", () => {
    const transport = vi.fn<ImpressionTransport>();
    render(<Cards transport={transport} />);
    show(POST_A, 0.4);
    advance(FLUSH_INTERVAL_MS * 2);
    expect(transport).not.toHaveBeenCalled();
  });

  it("con la pestaña oculta no corre el tiempo, y al ocultarla se manda lo pendiente con beacon", () => {
    const transport = vi.fn<ImpressionTransport>();
    render(<Cards transport={transport} />);

    show(POST_A, 1);
    advance(1_000);
    show(POST_B, 1);
    advance(500);
    setVisibility("hidden");
    expect(transport).toHaveBeenCalledExactlyOnceWith(
      [{ postId: POST_A, surface: "FEED", position: 0 }],
      "beacon",
    );

    advance(10_000);
    setVisibility("visible");
    advance(999);
    advance(FLUSH_INTERVAL_MS - 999);
    expect(transport).toHaveBeenLastCalledWith(
      [{ postId: POST_B, surface: "FEED", position: 1 }],
      "fetch",
    );
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("al salir de la página (pagehide) o desmontar la lista se manda lo que ya contó", () => {
    const transport = vi.fn<ImpressionTransport>();
    const { unmount } = render(<Cards transport={transport} />);
    show(POST_A, 1);
    advance(1_000);
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(transport).toHaveBeenCalledExactlyOnceWith(
      [{ postId: POST_A, surface: "FEED", position: 0 }],
      "beacon",
    );

    show(POST_B, 1);
    advance(1_000);
    unmount();
    expect(transport).toHaveBeenLastCalledWith(
      [{ postId: POST_B, surface: "FEED", position: 1 }],
      "beacon",
    );
  });
});

describe("FeedList mide lo servido por el ranking", () => {
  function item(id: string, position: number | null): FeedItemDTO {
    return {
      id,
      type: "POST",
      body: `Una publicación de prueba ${"con texto ".repeat(12)}`,
      publishedAt: new Date().toISOString(),
      isAiGenerated: false,
      author: {
        userId: "0199a000-0000-7000-8000-00000000aaaa",
        username: "ana",
        displayName: "Ana",
        avatarUrl: null,
        isEditorial: false,
        isSeller: false,
      },
      community: null,
      media: [],
      product: null,
      stats: { likes: 0, comments: 0, saves: 0, reactions: [] },
      viewer: { reaction: null, saved: false, withinBudget: false },
      ranking:
        position === null
          ? null
          : {
              position,
              score: 0.5,
              reason: "community",
              slot: "content",
              algorithmVersion: "v0-explicable",
              intent: null,
            },
    };
  }

  it("manda id, superficie y posición de lo visto (nunca más datos)", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <FeedList
        initialPage={{ items: [item(POST_A, 4), item(POST_B, null)], nextCursor: null }}
        community="gaming"
        empty={null}
      />,
    );
    // Sin ranking (no la sirvió el feed) no se mide.
    expect(document.querySelector(`[data-impression-post="${POST_B}"]`)).toBeNull();

    show(POST_A, 0.7);
    advance(1_000 + FLUSH_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/impressions");
    expect(JSON.parse(String(init.body))).toEqual({
      items: [{ postId: POST_A, surface: "COMMUNITY", position: 4 }],
    });
  });
});
