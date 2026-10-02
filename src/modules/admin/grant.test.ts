import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/server/db-client";
import {
  assertMakeAdminAllowed,
  describeRoleChange,
  isProductionTarget,
  MakeAdminError,
  parseMakeAdminArgs,
  setUserRole,
} from "./grant";

const LOCAL_DB = "postgresql://u:p@localhost:5434/speeaking";
const USER_ID = "0199a000-0000-7000-8000-000000000001";

describe("parseMakeAdminArgs", () => {
  it("lee el correo (normalizado) y las banderas", () => {
    expect(parseMakeAdminArgs(["  Fundador@Example.com "])).toEqual({
      email: "fundador@example.com",
      revoke: false,
      allowProduction: false,
    });
    expect(parseMakeAdminArgs(["--revoke", "fundador@example.com", "--allow-production"])).toEqual({
      email: "fundador@example.com",
      revoke: true,
      allowProduction: true,
    });
  });

  it("exige exactamente un correo válido", () => {
    expect(() => parseMakeAdminArgs([])).toThrow(MakeAdminError);
    expect(() => parseMakeAdminArgs(["a@example.com", "b@example.com"])).toThrow(/exactamente/);
    expect(() => parseMakeAdminArgs(["no-es-correo"])).toThrow(/Correo inválido/);
  });

  it("rechaza banderas desconocidas (un error de dedo no se ignora)", () => {
    expect(() => parseMakeAdminArgs(["a@example.com", "--allow-prod"])).toThrow(
      /Opción desconocida/,
    );
  });
});

describe("isProductionTarget / assertMakeAdminAllowed", () => {
  it("una base local en desarrollo no es producción", () => {
    expect(isProductionTarget({ DATABASE_URL: LOCAL_DB })).toBe(false);
    expect(isProductionTarget({ DATABASE_URL: "postgresql://u:p@127.0.0.1:5434/v" })).toBe(false);
    expect(isProductionTarget({ NODE_ENV: "development", DATABASE_URL: LOCAL_DB })).toBe(false);
  });

  it("NODE_ENV=production, un servidor remoto o una URL ilegible cuentan como producción", () => {
    expect(isProductionTarget({ NODE_ENV: "production", DATABASE_URL: LOCAL_DB })).toBe(true);
    expect(isProductionTarget({ DATABASE_URL: "postgresql://u:p@db.neon.tech/v" })).toBe(true);
    expect(isProductionTarget({ DATABASE_URL: "no es url" })).toBe(true);
    expect(isProductionTarget({})).toBe(true);
  });

  it("se niega en producción salvo con --allow-production", () => {
    const production = { DATABASE_URL: "postgresql://u:p@db.neon.tech/v?sslmode=require" };
    expect(() => assertMakeAdminAllowed(production, { allowProduction: false })).toThrow(
      /--allow-production/,
    );
    expect(() => assertMakeAdminAllowed(production, { allowProduction: true })).not.toThrow();
    expect(() =>
      assertMakeAdminAllowed({ DATABASE_URL: LOCAL_DB }, { allowProduction: false }),
    ).not.toThrow();
  });
});

function fakeDb(user: unknown) {
  const findFirst = vi.fn().mockResolvedValue(user);
  const update = vi.fn().mockResolvedValue({});
  const db = { user: { findFirst }, profile: { update } } as unknown as Database;
  return { db, findFirst, update };
}

describe("setUserRole", () => {
  it("da ADMIN buscando el correo sin distinguir mayúsculas", async () => {
    const { db, findFirst, update } = fakeDb({
      id: USER_ID,
      profile: { username: "equipo.demo", role: "USER" },
    });

    const change = await setUserRole(db, { email: "fundador@example.com", revoke: false });

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { equals: "fundador@example.com", mode: "insensitive" } },
      }),
    );
    expect(update).toHaveBeenCalledWith({ where: { userId: USER_ID }, data: { role: "ADMIN" } });
    expect(change).toEqual({
      userId: USER_ID,
      username: "equipo.demo",
      previousRole: "USER",
      role: "ADMIN",
      changed: true,
    });
    expect(describeRoleChange(change)).toMatch(/@equipo\.demo ahora es ADMIN/);
  });

  it("es idempotente: si ya tiene el rol no escribe", async () => {
    const { db, update } = fakeDb({
      id: USER_ID,
      profile: { username: "equipo.demo", role: "ADMIN" },
    });

    const change = await setUserRole(db, { email: "fundador@example.com", revoke: false });

    expect(update).not.toHaveBeenCalled();
    expect(change.changed).toBe(false);
    expect(describeRoleChange(change)).toMatch(/ya tenía el rol ADMIN/);
  });

  it("--revoke devuelve la cuenta a USER", async () => {
    const { db, update } = fakeDb({
      id: USER_ID,
      profile: { username: "equipo.demo", role: "ADMIN" },
    });

    const change = await setUserRole(db, { email: "fundador@example.com", revoke: true });

    expect(update).toHaveBeenCalledWith({ where: { userId: USER_ID }, data: { role: "USER" } });
    expect(describeRoleChange(change)).toMatch(/ya no es ADMIN/);
  });

  it("falla con un mensaje claro si no hay cuenta o no tiene perfil", async () => {
    await expect(
      setUserRole(fakeDb(null).db, { email: "nadie@example.com", revoke: false }),
    ).rejects.toThrow(/No existe una cuenta/);
    const noProfile = fakeDb({ id: USER_ID, profile: null });
    await expect(
      setUserRole(noProfile.db, { email: "fundador@example.com", revoke: false }),
    ).rejects.toThrow(/no ha terminado la bienvenida/);
    expect(noProfile.update).not.toHaveBeenCalled();
  });
});

describe("solo el script escribe el rol", () => {
  // Ninguna acción ni servicio de la app puede cambiar `Profile.role`: una escritura de perfil que lo
  // mencione fuera de `grant.ts` rompe esta prueba.
  const SRC = path.resolve(import.meta.dirname, "../..");
  const PROFILE_WRITE_WITH_ROLE =
    // `[^;]` ya cruza saltos de línea: no hace falta la bandera `s` (y el target ES2017 no la admite).
    /profile\.(?:update|upsert|create|updateMany|createMany)\([^;]*\brole\b/;

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === "generated" ? [] : sourceFiles(full);
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
    });
  }

  it("ningún archivo fuera de grant.ts escribe Profile.role", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => path.basename(file) !== "grant.ts")
      .filter((file) => PROFILE_WRITE_WITH_ROLE.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(SRC, file));
    expect(offenders).toEqual([]);
  });

  it("la regla sí detecta una escritura del rol", () => {
    expect(
      PROFILE_WRITE_WITH_ROLE.test(readFileSync(path.join(SRC, "modules/admin/grant.ts"), "utf8")),
    ).toBe(true);
  });
});
