import type { AttemptStatus, ScenarioStatus } from "../runner/types.js";

export function percent(ratio: number): string {
  return `${String(Math.round(ratio * 1000) / 10)}%`;
}

export function signedPercentPoints(delta: number): string {
  const points = Math.round(delta * 1000) / 10;
  return `${points > 0 ? "+" : ""}${String(points)} pp`;
}

export function usd(value: number | null): string {
  if (value === null) return "unknown";
  return value < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
}

export function duration(ms: number): string {
  return ms < 1000 ? `${String(Math.round(ms))} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function tokens(count: number): string {
  return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
}

export const STATUS_ICON: Record<ScenarioStatus | AttemptStatus, string> = {
  pass: "✅",
  fail: "❌",
  flaky: "⚠️",
  error: "💥",
};
