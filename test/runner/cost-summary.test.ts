import { describe, expect, it } from "vitest";

import { withTimeout } from "../../src/core/timeout.js";
import { costOf, sumCosts } from "../../src/runner/cost.js";
import { percentile, scenarioStatus } from "../../src/runner/summarize.js";
import type { AttemptResult } from "../../src/runner/types.js";

const prices = {
  agent: { inputPerMillion: 1, outputPerMillion: 5 },
  judge: { inputPerMillion: 3, outputPerMillion: 15 },
};

describe("costOf", () => {
  it("prices each model's tokens", () => {
    expect(
      costOf(
        [
          { model: "agent", usage: { inputTokens: 10_000, outputTokens: 2_000 } },
          { model: "judge", usage: { inputTokens: 1_000, outputTokens: 100 } },
        ],
        prices,
      ),
    ).toBe(0.0245);
  });

  it("ignores unused models and returns null when a used model has no price", () => {
    expect(
      costOf([{ model: "unpriced", usage: { inputTokens: 0, outputTokens: 0 } }], prices),
    ).toBe(0);
    expect(
      costOf([{ model: "unpriced", usage: { inputTokens: 1, outputTokens: 0 } }], prices),
    ).toBeNull();
    expect(costOf([{ model: "agent", usage: { inputTokens: 1, outputTokens: 0 } }])).toBeNull();
  });

  it("sums costs only when all are known", () => {
    expect(sumCosts([0.1, 0.2])).toBe(0.3);
    expect(sumCosts([0.1, null])).toBeNull();
    expect(sumCosts([])).toBe(0);
  });
});

describe("percentile", () => {
  it("uses the nearest rank", () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(values, 0.5)).toBe(50);
    expect(percentile(values, 0.95)).toBe(100);
    expect(percentile([7], 0.95)).toBe(7);
    expect(percentile([], 0.5)).toBe(0);
  });
});

describe("scenarioStatus", () => {
  const attempt = (status: AttemptResult["status"]) => ({ status }) as AttemptResult;

  it.each([
    [["pass", "pass"], "pass"],
    [["fail", "fail"], "fail"],
    [["pass", "fail"], "flaky"],
    [["pass", "error"], "error"],
  ] as const)("%j is %s", (statuses, expected) => {
    expect(scenarioStatus(statuses.map(attempt))).toBe(expected);
  });
});

describe("withTimeout", () => {
  it("returns the task result in time", async () => {
    await expect(withTimeout(1000, () => Promise.resolve("done"))).resolves.toBe("done");
  });

  it("aborts the task and rejects with TIMEOUT", async () => {
    let aborted = false;
    const task = (signal: AbortSignal) =>
      new Promise<string>((resolve) => {
        signal.addEventListener("abort", () => {
          aborted = true;
        });
        setTimeout(() => {
          resolve("late");
        }, 200);
      });
    await expect(withTimeout(10, task)).rejects.toMatchObject({ code: "TIMEOUT" });
    expect(aborted).toBe(true);
  });
});
