import type { AgentDefinition } from "../agent/definition.js";
import type { Transcript } from "../agent/transcript.js";
import type { CheckResult } from "../checks/types.js";
import type { JudgeConfig, Verdict } from "../judge/judge.js";
import type { Provider, Usage } from "../providers/types.js";

/** Price of a model in US dollars per million tokens. */
export interface ModelPrice {
  inputPerMillion: number;
  outputPerMillion: number;
}

export interface RunConfig {
  agent: AgentDefinition;
  provider: Provider;
  judge?: JudgeConfig;
  /** Attempts per scenario; more attempts expose flaky behavior. Defaults to 1. */
  repeat?: number;
  /** Attempts running at the same time. Defaults to 4. */
  concurrency?: number;
  /** Limit per attempt, conversation and judge included. Defaults to 120 000 ms. */
  timeoutMs?: number;
  /** Prices by model id; without a price, cost is reported as `null`. */
  prices?: Readonly<Record<string, ModelPrice>>;
}

export const RUN_DEFAULTS = { repeat: 1, concurrency: 4, timeoutMs: 120_000 } as const;

/** An attempt passes only when every check and the judge pass. Errors never count as passes. */
export type AttemptStatus = "pass" | "fail" | "error";

export interface AttemptResult {
  attempt: number;
  status: AttemptStatus;
  checks: CheckResult[];
  judge: { verdict: Verdict; reasoning: string } | null;
  error: { code: string; message: string } | null;
  transcript: Transcript | null;
  usage: { agent: Usage; judge: Usage };
  costUsd: number | null;
  latencyMs: number;
}

/** `flaky` means some attempts passed and some did not. */
export type ScenarioStatus = "pass" | "fail" | "flaky" | "error";

export interface ScenarioResult {
  id: string;
  file: string;
  tags: string[];
  status: ScenarioStatus;
  passRate: number;
  attempts: AttemptResult[];
}

export interface RunSummary {
  scenarios: number;
  attempts: number;
  passed: number;
  failed: number;
  errors: number;
  passRate: number;
  byStatus: Record<ScenarioStatus, number>;
  usage: { agent: Usage; judge: Usage };
  costUsd: number | null;
  latencyMs: { p50: number; p95: number; max: number };
}

/** Everything a run produced, serializable as JSON and comparable with another run. */
export interface RunResult {
  version: 1;
  startedAt: string;
  finishedAt: string;
  agent: { name: string; model: string };
  judge: { model: string } | null;
  repeat: number;
  summary: RunSummary;
  scenarios: ScenarioResult[];
}
