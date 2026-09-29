import { describe, expect, it } from "vitest";

import { mapWithLimit } from "../../src/core/concurrency.js";

describe("mapWithLimit", () => {
  it("keeps the input order", async () => {
    const delays = [30, 5, 15, 0];
    const result = await mapWithLimit(delays, 2, async (delay) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return delay;
    });
    expect(result).toEqual(delays);
  });

  it("never runs more tasks than the limit", async () => {
    let running = 0;
    let peak = 0;
    await mapWithLimit(
      Array.from({ length: 20 }, (_, i) => i),
      3,
      async () => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 1));
        running -= 1;
      },
    );
    expect(peak).toBe(3);
  });

  it("handles empty input", async () => {
    await expect(mapWithLimit([], 4, () => Promise.resolve(1))).resolves.toEqual([]);
  });
});
