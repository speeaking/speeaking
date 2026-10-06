import { describe, expect, it, vi } from "vitest";
import { siteConfig } from "@/config/site";
import { INDEXNOW_KEY_PATH, notifyIndexNow } from "./indexnow";

const production = { APP_URL: "https://www.speeaking.com", ALLOW_INDEXING: true };
const ok = () =>
  vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(null, { status: 200 }),
  );

describe("notifyIndexNow: avisa a Bing (y a quien use IndexNow) cuando cambia un producto", () => {
  it("manda las URLs con la llave y dónde comprobarla", async () => {
    const fetch = ok();

    const sent = await notifyIndexNow(["https://www.speeaking.com/producto/vela-9b0c59"], {
      env: production,
      fetch,
    });

    expect(sent).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.indexnow.org/indexnow",
      expect.objectContaining({ method: "POST" }),
    );
    const init = fetch.mock.calls[0]![1]!;
    expect(JSON.parse(String(init.body))).toEqual({
      host: "www.speeaking.com",
      key: siteConfig.indexNowKey,
      keyLocation: `https://www.speeaking.com${INDEXNOW_KEY_PATH}`,
      urlList: ["https://www.speeaking.com/producto/vela-9b0c59"],
    });
  });

  it("sin indexación (desarrollo, vistas previas) o sin URLs no avisa a nadie", async () => {
    const fetch = ok();

    expect(
      await notifyIndexNow(["http://localhost:3000/producto/x"], {
        env: { APP_URL: "http://localhost:3000", ALLOW_INDEXING: true },
        fetch,
      }),
    ).toBe(false);
    expect(
      await notifyIndexNow(["https://www.speeaking.com/producto/x"], {
        env: { ...production, ALLOW_INDEXING: false },
        fetch,
      }),
    ).toBe(false);
    expect(await notifyIndexNow([], { env: production, fetch })).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("solo URLs del propio sitio: nunca manda otra", async () => {
    const fetch = ok();

    await notifyIndexNow(
      ["https://www.speeaking.com/producto/a", "https://otro.example/producto/b"],
      { env: production, fetch },
    );

    const init = fetch.mock.calls[0]![1]!;
    expect(JSON.parse(String(init.body)).urlList).toEqual(["https://www.speeaking.com/producto/a"]);
  });

  it("si IndexNow falla o no responde, la venta sigue (no lanza)", async () => {
    const fetch = vi.fn(async () => {
      throw new Error("sin red");
    });

    await expect(
      notifyIndexNow(["https://www.speeaking.com/producto/a"], { env: production, fetch }),
    ).resolves.toBe(false);
  });

  it("la llave tiene la forma que pide IndexNow", () => {
    expect(siteConfig.indexNowKey).toMatch(/^[a-f0-9]{32}$/);
  });
});
