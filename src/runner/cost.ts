import type { Usage } from "../providers/types.js";
import type { ModelPrice } from "./types.js";

export interface PricedUsage {
  model: string;
  usage: Usage;
}

/** Returns `null` when any model involved has no price, so a partial total is never shown as the whole. */
export function costOf(
  items: readonly PricedUsage[],
  prices: Readonly<Record<string, ModelPrice>> = {},
): number | null {
  let total = 0;
  for (const { model, usage } of items) {
    if (usage.inputTokens === 0 && usage.outputTokens === 0) continue;
    const price = prices[model];
    if (price === undefined) return null;
    total +=
      (usage.inputTokens * price.inputPerMillion + usage.outputTokens * price.outputPerMillion) /
      1_000_000;
  }
  return Math.round(total * 1_000_000) / 1_000_000;
}

export function sumCosts(costs: readonly (number | null)[]): number | null {
  if (costs.some((cost) => cost === null)) return null;
  const total = costs.reduce<number>((sum, cost) => sum + (cost ?? 0), 0);
  return Math.round(total * 1_000_000) / 1_000_000;
}
