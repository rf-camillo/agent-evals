import { EvalError } from "./errors.js";

/**
 * Runs `task` with an abort signal and rejects with a TIMEOUT error after `ms`.
 * The signal lets the task cancel in-flight requests instead of leaking them.
 */
export async function withTimeout<T>(
  ms: number,
  task: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new EvalError("TIMEOUT", `Timed out after ${String(ms)} ms`));
    }, ms);
  });
  try {
    return await Promise.race([task(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
