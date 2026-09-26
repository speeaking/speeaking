import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_VISIBLE_IMPRESSIONS_PER_REQUEST } from "@/modules/analytics/visible-impression-contract";
import {
  IMPRESSIONS_ENDPOINT,
  ImpressionBatcher,
  isViewable,
  MAX_BATCH,
  sendImpressions,
  ViewabilityTracker,
} from "./visible-impressions";

const report = (index: number) => ({
  postId: `0199a000-0000-7000-8000-${String(index).padStart(12, "0")}`,
  surface: "FEED" as const,
  position: index,
});

describe("¿está en pantalla? (≥ 50 % de la pieza)", () => {
  it("cuenta desde la mitad de la pieza", () => {
    expect(isViewable({ isIntersecting: true, intersectionRatio: 0.5 })).toBe(true);
    expect(isViewable({ isIntersecting: true, intersectionRatio: 0.49 })).toBe(false);
    expect(isViewable({ isIntersecting: false, intersectionRatio: 0.9 })).toBe(false);
  });

  it("una pieza más alta que dos pantallas cuenta si ocupa al menos media pantalla", () => {
    const tall = { isIntersecting: true, intersectionRatio: 0.3, rootBounds: { height: 800 } };
    expect(isViewable({ ...tall, intersectionRect: { height: 800 } })).toBe(true);
    expect(isViewable({ ...tall, intersectionRect: { height: 300 } })).toBe(false);
  });
});

describe("cronómetro de visibilidad (1 s continuo)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("≥ 1 s en pantalla cuenta una sola vez; 200 ms no cuentan", () => {
    const onVisible = vi.fn();
    const tracker = new ViewabilityTracker(onVisible);

    tracker.update("flash", true);
    vi.advanceTimersByTime(200);
    tracker.update("flash", false);
    vi.advanceTimersByTime(5_000);
    expect(onVisible).not.toHaveBeenCalled();

    tracker.update("card", true);
    vi.advanceTimersByTime(999);
    expect(onVisible).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onVisible).toHaveBeenCalledExactlyOnceWith("card");

    // Sale y vuelve a entrar: ya contó en esta vista de la página.
    tracker.update("card", false);
    tracker.update("card", true);
    vi.advanceTimersByTime(5_000);
    expect(onVisible).toHaveBeenCalledOnce();
    expect(tracker.hasCounted("card")).toBe(true);
  });

  it("debe ser continuo: si sale antes del segundo, el conteo empieza de nuevo", () => {
    const onVisible = vi.fn();
    const tracker = new ViewabilityTracker(onVisible);
    tracker.update("card", true);
    vi.advanceTimersByTime(700);
    tracker.update("card", false);
    tracker.update("card", true);
    vi.advanceTimersByTime(700);
    expect(onVisible).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onVisible).toHaveBeenCalledOnce();
  });

  it("con la pestaña oculta se pausa; al volver cuenta un segundo completo", () => {
    const onVisible = vi.fn();
    const tracker = new ViewabilityTracker(onVisible);
    tracker.update("card", true);
    vi.advanceTimersByTime(600);
    tracker.setPageVisible(false);
    vi.advanceTimersByTime(10_000);
    expect(onVisible).not.toHaveBeenCalled();

    tracker.setPageVisible(true);
    vi.advanceTimersByTime(999);
    expect(onVisible).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onVisible).toHaveBeenCalledOnce();
  });

  it("si la página carga en una pestaña oculta, nada cuenta hasta que se vea", () => {
    const onVisible = vi.fn();
    const tracker = new ViewabilityTracker(onVisible, { pageVisible: false });
    tracker.update("card", true);
    vi.advanceTimersByTime(5_000);
    expect(onVisible).not.toHaveBeenCalled();
    tracker.setPageVisible(true);
    vi.advanceTimersByTime(1_000);
    expect(onVisible).toHaveBeenCalledOnce();
  });

  it("una pieza que se quita de la lista no cuenta", () => {
    const onVisible = vi.fn();
    const tracker = new ViewabilityTracker(onVisible);
    tracker.update("card", true);
    tracker.forget("card");
    vi.advanceTimersByTime(2_000);
    expect(onVisible).not.toHaveBeenCalled();
  });
});

describe("envío en lotes", () => {
  it("el tope del lote es el mismo que valida el servidor", () => {
    expect(MAX_BATCH).toBe(MAX_VISIBLE_IMPRESSIONS_PER_REQUEST);
  });

  it("vacía la cola en lotes de a lo más 50; sin nada que mandar no manda nada", () => {
    const send = vi.fn();
    const batcher = new ImpressionBatcher(send);
    batcher.flush("fetch");
    expect(send).not.toHaveBeenCalled();

    for (let index = 0; index < 120; index++) batcher.add(report(index));
    batcher.flush("beacon");
    expect(send.mock.calls.map(([items, mode]) => [items.length, mode])).toEqual([
      [50, "beacon"],
      [50, "beacon"],
      [20, "beacon"],
    ]);
    expect(batcher.size).toBe(0);
  });

  describe("transporte", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("al salir usa sendBeacon con text/plain (sin permiso previo); si falla, fetch con keepalive", async () => {
      const sendBeacon = vi.fn(() => true);
      const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
      vi.stubGlobal("navigator", { sendBeacon });
      vi.stubGlobal("fetch", fetchMock);

      sendImpressions([report(1)], "beacon");
      expect(sendBeacon).toHaveBeenCalledOnce();
      const [url, blob] = sendBeacon.mock.calls[0] as unknown as [string, Blob];
      expect(url).toBe(IMPRESSIONS_ENDPOINT);
      expect(blob.type).toBe("text/plain;charset=utf-8");
      expect(JSON.parse(await blob.text())).toEqual({ items: [report(1)] });
      expect(fetchMock).not.toHaveBeenCalled();

      sendBeacon.mockReturnValue(false);
      sendImpressions([report(2)], "beacon");
      expect(fetchMock).toHaveBeenCalledWith(
        IMPRESSIONS_ENDPOINT,
        expect.objectContaining({ method: "POST", keepalive: true }),
      );
    });

    it("cada 5 s manda con fetch, y un error de red no rompe nada", async () => {
      const fetchMock = vi.fn(async () => {
        throw new TypeError("sin red");
      });
      vi.stubGlobal("fetch", fetchMock);
      expect(() => sendImpressions([report(3)], "fetch")).not.toThrow();
      await Promise.resolve();
      expect(fetchMock).toHaveBeenCalledOnce();
    });
  });
});
