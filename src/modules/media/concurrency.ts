/**
 * Cola con tope para trabajo caro dentro del proceso web (SEC-13): a lo más `concurrency` tareas a la
 * vez y `maxQueued` esperando turno. Si la cola está llena, `run` falla de inmediato con `BusyError`
 * en lugar de acumular peticiones (y sus cuerpos en memoria) sin límite.
 */
export class BusyError extends Error {
  override name = "BusyError";
  constructor() {
    super("Demasiadas tareas en cola");
  }
}

export type Limiter = {
  run<T>(task: () => Promise<T>): Promise<T>;
  /** No cabe otra tarea: sirve para rechazar antes de leer un cuerpo que después no se podría procesar. */
  readonly full: boolean;
  readonly active: number;
  readonly queued: number;
};

export function createLimiter(concurrency: number, maxQueued: number): Limiter {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError("La concurrencia debe ser un entero ≥ 1.");
  }
  if (!Number.isInteger(maxQueued) || maxQueued < 0) {
    throw new RangeError("La cola debe ser un entero ≥ 0.");
  }
  let active = 0;
  const waiting: Array<() => void> = [];

  return {
    get full() {
      return active >= concurrency && waiting.length >= maxQueued;
    },
    get active() {
      return active;
    },
    get queued() {
      return waiting.length;
    },
    async run(task) {
      if (active < concurrency) {
        active += 1;
      } else if (waiting.length < maxQueued) {
        // Quien termina le pasa su lugar directamente: `active` no baja ni sube.
        await new Promise<void>((resolve) => waiting.push(resolve));
      } else {
        throw new BusyError();
      }
      try {
        return await task();
      } finally {
        const next = waiting.shift();
        if (next) next();
        else active -= 1;
      }
    },
  };
}

/** La fila propia de una llave (p. ej. una persona) está llena. */
export class KeyBusyError extends BusyError {
  override name = "KeyBusyError";
}

export type KeyedLimiter = {
  run<T>(key: string, task: () => Promise<T>): Promise<T>;
  /** Llaves con tareas activas o en espera (las demás no ocupan memoria). */
  readonly keys: number;
};

/**
 * Una fila por llave delante de `shared`: cada llave ocupa a lo más `perKey` lugares de la cola
 * compartida y el resto espera en su propia fila (hasta `maxQueuedPerKey`). Así una sola cuenta, con
 * muchas peticiones o conexiones lentas a propósito, no acapara los lugares de todos.
 * Fila propia llena → `KeyBusyError`; cola compartida llena → `BusyError`.
 */
export function createKeyedLimiter(
  shared: Limiter,
  perKey: number,
  maxQueuedPerKey: number,
): KeyedLimiter {
  const byKey = new Map<string, Limiter>();

  return {
    get keys() {
      return byKey.size;
    },
    async run(key, task) {
      let limiter = byKey.get(key);
      if (!limiter) {
        limiter = createLimiter(perKey, maxQueuedPerKey);
        byKey.set(key, limiter);
      }
      let started = false;
      try {
        return await limiter.run(() => {
          started = true;
          return shared.run(task);
        });
      } catch (error) {
        if (!started && error instanceof BusyError) throw new KeyBusyError();
        throw error;
      } finally {
        if (limiter.active === 0 && limiter.queued === 0 && byKey.get(key) === limiter) {
          byKey.delete(key);
        }
      }
    },
  };
}
