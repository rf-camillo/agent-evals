import { performance } from "node:perf_hooks";

import { runConversation } from "../agent/run-conversation.js";
import { sumUsage } from "../agent/transcript.js";
import { TranscriptRecorder } from "../agent/transcript-recorder.js";
import { runChecks } from "../checks/run-checks.js";
import type { CheckResult } from "../checks/types.js";
import { errorMessage, EvalError } from "../core/errors.js";
import { withTimeout } from "../core/timeout.js";
import { judge, type JudgeResult } from "../judge/judge.js";
import { JudgeError } from "../judge/judge-error.js";
import type { Usage } from "../providers/types.js";
import type { LoadedScenario } from "../scenarios/load.js";
import { costOf } from "./cost.js";
import { type AttemptResult, RUN_DEFAULTS, type RunConfig } from "./types.js";

/** What an attempt produced so far; kept when a later stage fails. */
interface Progress {
  recorder: TranscriptRecorder;
  checks: CheckResult[];
  verdict: JudgeResult | null;
  judgeUsage: Usage;
}

async function evaluate(
  config: RunConfig,
  { scenario }: LoadedScenario,
  progress: Progress,
  signal: AbortSignal,
): Promise<void> {
  const userTurns = scenario.turns.map((turn) => turn.user);
  const transcript = await runConversation(config.agent, config.provider, userTurns, {
    signal,
    recorder: progress.recorder,
  });
  progress.checks = runChecks({ scenario, transcript, agent: config.agent });
  if (scenario.judge === undefined || config.judge === undefined) return;
  progress.verdict = await judge(config.judge, {
    rubric: scenario.judge.rubric,
    facts: scenario.facts,
    transcript,
  });
  progress.judgeUsage = progress.verdict.usage;
}

function describeError(error: unknown): { code: string; message: string } {
  return error instanceof EvalError
    ? { code: error.code, message: error.message }
    : { code: "UNEXPECTED", message: errorMessage(error) };
}

function assemble(
  config: RunConfig,
  attempt: number,
  progress: Progress,
  error: unknown,
  latencyMs: number,
): AttemptResult {
  const transcript = progress.recorder.snapshot();
  const { verdict, checks } = progress;
  const failed =
    error !== undefined || checks.some((check) => !check.passed) || verdict?.verdict === "fail";
  const status = error === undefined ? (failed ? "fail" : "pass") : "error";
  return {
    attempt,
    status,
    checks,
    judge: verdict === null ? null : { verdict: verdict.verdict, reasoning: verdict.reasoning },
    error: error === undefined ? null : describeError(error),
    transcript: transcript.turns.length === 0 ? null : transcript,
    usage: { agent: transcript.usage, judge: progress.judgeUsage },
    costUsd: costOf(
      [
        { model: config.agent.model, usage: transcript.usage },
        { model: config.judge?.model ?? "", usage: progress.judgeUsage },
      ],
      config.prices,
    ),
    latencyMs,
  };
}

/**
 * Runs one attempt of one scenario. Every failure becomes an error result that keeps
 * whatever happened before it: the partial transcript, the checks and the tokens spent.
 */
export async function runAttempt(
  config: RunConfig,
  loaded: LoadedScenario,
  attempt: number,
): Promise<AttemptResult> {
  const started = performance.now();
  const progress: Progress = {
    recorder: new TranscriptRecorder(),
    checks: [],
    verdict: null,
    judgeUsage: sumUsage([]),
  };
  let error: unknown;
  try {
    await withTimeout(config.timeoutMs ?? RUN_DEFAULTS.timeoutMs, (signal) =>
      evaluate(config, loaded, progress, signal),
    );
  } catch (caught) {
    error = caught;
    if (caught instanceof JudgeError) progress.judgeUsage = caught.usage;
  }
  return assemble(config, attempt, progress, error, Math.round(performance.now() - started));
}
