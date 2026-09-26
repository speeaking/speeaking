import { describe, expect, it } from "vitest";
import { BusyError, createLimiter } from "./concurrency";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

const tick = () => new Promise((done) => setTimeout(done, 0));

describe("createLimiter", () => {
  it("nunca corre más tareas que la concurrencia; las demás esperan en orden", async () => {
    const limiter = createLimiter(2, 10);
    const gates = Array.from({ length: 5 }, deferred);
    let running = 0;
    let peak = 0;
    const order: number[] = [];

    const tasks = gates.map((gate, index) =>
      limiter.run(async () => {
        running += 1;
        peak = Math.max(peak, running);
        order.push(index);
        await gate.promise;
        running -= 1;
        return index;
      }),
    );
    await tick();
    expect(limiter.active).toBe(2);
    expect(limiter.queued).toBe(3);

    for (const gate of gates) {
      gate.resolve();
      await tick();
    }

    await expect(Promise.all(tasks)).resolves.toEqual([0, 1, 2, 3, 4]);
    expect(peak).toBe(2);
    expect(order).toEqual([0, 1, 2, 3, 4]);
    expect(limiter.active).toBe(0);
  });

  it("con la cola llena falla de inmediato con BusyError (sin acumular trabajo)", async () => {
    const limiter = createLimiter(1, 1);
    const gate = deferred();
    const first = limiter.run(() => gate.promise);
    const second = limiter.run(async () => "segunda");

    expect(limiter.full).toBe(true);
    await expect(limiter.run(async () => "tercera")).rejects.toBeInstanceOf(BusyError);

    gate.resolve();
    await first;
    await expect(second).resolves.toBe("segunda");
    expect(limiter.full).toBe(false);
  });

  it("una tarea que falla libera su lugar", async () => {
    const limiter = createLimiter(1, 0);

    await expect(limiter.run(() => Promise.reject(new Error("falla")))).rejects.toThrow("falla");
    await expect(limiter.run(async () => "después")).resolves.toBe("después");
  });
});
