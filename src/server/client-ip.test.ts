import { getIP } from "better-auth/api";
import { afterEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  NODE_ENV: "test" as "development" | "test" | "production",
  TRUSTED_PROXY_HOPS: 0,
}));
vi.mock("./env", () => ({ env }));

const {
  CLIENT_IP_HEADER,
  authIpAddressOptions,
  clientIp,
  ipNetwork,
  normalizeIp,
  resolveClientIp,
  withClientIpHeader,
  withClientIpRequest,
} = await import("./client-ip");

function xff(value: string) {
  return new Headers({ "x-forwarded-for": value });
}

afterEach(() => {
  env.NODE_ENV = "test";
  env.TRUSTED_PROXY_HOPS = 0;
  vi.restoreAllMocks();
});

describe("normalizeIp", () => {
  it("acepta IPv4 e IPv6 y deja la IPv6 en forma canónica", () => {
    expect(normalizeIp("203.0.113.9")).toBe("203.0.113.9");
    expect(normalizeIp(" 203.0.113.9 ")).toBe("203.0.113.9");
    expect(normalizeIp("2001:0DB8:0000:0000:0000:0000:0000:0001")).toBe("2001:db8::1");
    expect(normalizeIp("::1")).toBe("::1");
  });

  it("convierte las IPv4 mapeadas en IPv6 a IPv4", () => {
    expect(normalizeIp("::ffff:192.0.2.1")).toBe("192.0.2.1");
    expect(normalizeIp("::FFFF:c000:0201")).toBe("192.0.2.1");
  });

  it("quita corchetes y puertos que algunos proxies incluyen", () => {
    expect(normalizeIp("[2001:db8::1]")).toBe("2001:db8::1");
    expect(normalizeIp("[2001:db8::1]:443")).toBe("2001:db8::1");
    expect(normalizeIp("203.0.113.9:51234")).toBe("203.0.113.9");
  });

  it.each([
    "",
    "unknown",
    "_hidden",
    "1.2.3",
    "256.1.1.1",
    "01.2.3.4",
    "fe80::1%eth0",
    "1.2.3.4, 5.6.7.8",
    "<script>alert(1)</script>",
    "1.2.3.4 OR 1=1",
    `1.2.3.4${" ".repeat(10)}x`,
    "a".repeat(10_000),
  ])("rechaza %j", (value) => {
    expect(normalizeIp(value)).toBeNull();
  });
});

describe("ipNetwork", () => {
  it("IPv4 tal cual; IPv6 agrupada por su /64", () => {
    expect(ipNetwork("203.0.113.9")).toBe("203.0.113.9");
    expect(ipNetwork("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe("2001:db8:1:2::/64");
    expect(ipNetwork("2001:db8:1:2::1")).toBe("2001:db8:1:2::/64");
    expect(ipNetwork("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(ipNetwork("::ffff:192.0.2.1")).toBe("192.0.2.1");
    expect(ipNetwork("unknown")).toBeNull();
  });
});

describe("resolveClientIp", () => {
  it("con 0 saltos ignora X-Forwarded-For por completo (Next expuesto directo)", () => {
    expect(resolveClientIp(xff("192.0.2.55"), 0)).toBeNull();
    expect(resolveClientIp(xff("203.0.113.9, 172.70.1.2"), 0)).toBeNull();
    expect(resolveClientIp(new Headers(), 0)).toBeNull();
  });

  it("con 1 salto toma la entrada que agregó el proxy y descarta lo que mandó el cliente", () => {
    expect(resolveClientIp(xff("203.0.113.9"), 1)).toBe("203.0.113.9");
    expect(resolveClientIp(xff("6.6.6.6, 203.0.113.9"), 1)).toBe("203.0.113.9");
    expect(resolveClientIp(xff("no-es-ip, 203.0.113.9"), 1)).toBe("203.0.113.9");
  });

  it("con 1 salto, rotar un X-Forwarded-For falso no da IPs nuevas (PoC de SEC-07, caso A)", () => {
    const seen = new Set(
      [101, 102, 103, 104, 105, 106].map((n) =>
        resolveClientIp(xff(`192.0.2.${n}, 198.51.100.23`), 1),
      ),
    );
    expect([...seen]).toEqual(["198.51.100.23"]);
  });

  it("con 2 saltos (Cloudflare → nginx) resuelve al usuario real, no a la cubeta compartida", () => {
    expect(resolveClientIp(xff("203.0.113.9, 172.70.1.2"), 2)).toBe("203.0.113.9");
    // El atacante manda su propio XFF: Cloudflare agrega su IP real y nginx la del borde.
    expect(resolveClientIp(xff("6.6.6.6, 1.1.1.1, 203.0.113.9, 172.70.1.2"), 2)).toBe(
      "203.0.113.9",
    );
  });

  it("devuelve null si la cadena es más corta que los saltos (no pasó por todos los proxies)", () => {
    expect(resolveClientIp(xff("203.0.113.9"), 2)).toBeNull();
    expect(resolveClientIp(new Headers(), 1)).toBeNull();
    expect(resolveClientIp(xff(""), 1)).toBeNull();
  });

  it("devuelve null si la entrada confiable no es una IP válida", () => {
    expect(resolveClientIp(xff("203.0.113.9, unknown"), 1)).toBeNull();
    expect(resolveClientIp(xff("203.0.113.9, "), 1)).toBeNull();
  });

  it("une varias líneas de la cabecera en orden", () => {
    const headers = new Headers();
    headers.append("x-forwarded-for", "6.6.6.6");
    headers.append("x-forwarded-for", "203.0.113.9");
    expect(resolveClientIp(headers, 1)).toBe("203.0.113.9");
  });

  it("no acepta saltos inválidos", () => {
    expect(resolveClientIp(xff("203.0.113.9"), -1)).toBeNull();
    expect(resolveClientIp(xff("203.0.113.9"), 1.5)).toBeNull();
  });

  it("nunca lee otras cabeceras de IP que el cliente controla", () => {
    const headers = new Headers({
      "x-real-ip": "9.9.9.9",
      "cf-connecting-ip": "9.9.9.9",
      [CLIENT_IP_HEADER]: "9.9.9.9",
    });
    expect(resolveClientIp(headers, 1)).toBeNull();
  });
});

describe("clientIp", () => {
  it("usa TRUSTED_PROXY_HOPS (0 por omisión)", () => {
    expect(clientIp(xff("203.0.113.9"))).toBeNull();
    env.TRUSTED_PROXY_HOPS = 1;
    expect(clientIp(xff("6.6.6.6, 203.0.113.9"))).toBe("203.0.113.9");
  });

  it("en producción avisa una sola vez que no hay IP confiable", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    env.NODE_ENV = "production";
    clientIp(xff("203.0.113.9"));
    clientIp(xff("203.0.113.9"));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("TRUSTED_PROXY_HOPS=0");
    expect(warn.mock.calls[0]?.[0]).not.toContain("203.0.113.9");
  });
});

describe("withClientIpHeader", () => {
  it("reemplaza el valor que mande el cliente por la IP resuelta", () => {
    env.TRUSTED_PROXY_HOPS = 1;
    const original = new Headers({
      "x-forwarded-for": "6.6.6.6, 203.0.113.9",
      [CLIENT_IP_HEADER]: "9.9.9.9",
      cookie: "a=1",
    });
    const headers = withClientIpHeader(original);
    expect(headers.get(CLIENT_IP_HEADER)).toBe("203.0.113.9");
    expect(headers.get("cookie")).toBe("a=1");
    expect(original.get(CLIENT_IP_HEADER)).toBe("9.9.9.9");
  });

  it("quita la cabecera cuando no hay IP confiable", () => {
    const headers = withClientIpHeader(xffWithClientHeader("203.0.113.9", "9.9.9.9"));
    expect(headers.has(CLIENT_IP_HEADER)).toBe(false);
  });

  it("conserva método y cuerpo al copiar una petición", async () => {
    env.TRUSTED_PROXY_HOPS = 1;
    const request = new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.9", [CLIENT_IP_HEADER]: "9.9.9.9" },
      body: JSON.stringify({ email: "e2e@example.com" }),
    });
    const copy = withClientIpRequest(request);
    expect(copy.method).toBe("POST");
    expect(copy.headers.get(CLIENT_IP_HEADER)).toBe("203.0.113.9");
    expect(await copy.json()).toEqual({ email: "e2e@example.com" });
  });
});

describe("Better Auth con authIpAddressOptions", () => {
  const options = { advanced: { ipAddress: authIpAddressOptions } };
  // Fuera de producción, Better Auth usa 127.0.0.1 cuando no hay IP; en producción, `null`.
  const betterAuthFallback = "127.0.0.1";

  it.each([
    { hops: 0, header: "192.0.2.55" },
    { hops: 0, header: "203.0.113.9, 172.70.1.2" },
    { hops: 1, header: "6.6.6.6, 203.0.113.9" },
    { hops: 1, header: "203.0.113.9, unknown" },
    { hops: 2, header: "6.6.6.6, 203.0.113.9, 172.70.1.2" },
    { hops: 2, header: "203.0.113.9" },
  ])("resuelve la misma IP que clientIp ($hops saltos, $header)", ({ hops, header }) => {
    env.TRUSTED_PROXY_HOPS = hops;
    const headers = xffWithClientHeader(header, "9.9.9.9");
    const expected = clientIp(headers) ?? betterAuthFallback;
    expect(getIP(withClientIpHeader(headers), options)).toBe(expected);
  });

  it("nunca usa un X-Forwarded-For ni una cabecera interna falsificados", () => {
    for (const hops of [0, 1, 2]) {
      env.TRUSTED_PROXY_HOPS = hops;
      const ip = getIP(withClientIpHeader(xffWithClientHeader("192.0.2.55", "9.9.9.9")), options);
      expect(ip).not.toBe("9.9.9.9");
      if (hops !== 1) expect(ip).not.toBe("192.0.2.55");
    }
  });
});

function xffWithClientHeader(forwardedFor: string, clientHeader: string) {
  return new Headers({ "x-forwarded-for": forwardedFor, [CLIENT_IP_HEADER]: clientHeader });
}
