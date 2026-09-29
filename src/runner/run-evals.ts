import { mapWithLimit } from "../core/concurrency.js";
import { EvalError } from "../core/errors.js";
import type { LoadedScenario } from "../scenarios/load.js";
import { runAttempt } from "./run-attempt.js";
import { scenarioPassRate, scenarioStatus, summarize } from "./summarize.js";
import {
  type AttemptResult,
  RUN_DEFAULTS,
  type RunConfig,
  type RunResult,
  type ScenarioResult,
} from "./types.js";

export type ProgressListener = (done: number, total: number, attempt: AttemptResult) => void;

function assertRunnable(scenarios: readonly LoadedScenario[], config: RunConfig): void {
  if (config.judge !== undefined) return;
  const needJudge = scenarios.filter(({ scenario }) => scenario.judge !== undefined);
  if (needJudge.length > 0) {
    const ids = needJudge.map(({ scenario }) => scenario.id).join(", ");
    throw new EvalError(
      "INVALID_INPUT",
      `These scenarios have a judge rubric but no judge is configured: ${ids}`,
    );
  }
}

/**
 * Runs every scenario `repeat` times with bounded concurrency and returns a result
 * that can be saved, reported and compared with another run.
 */
export async function runEvals(
  scenarios: readonly LoadedScenario[],
  config: RunConfig,
  onProgress?: ProgressListener,
): Promise<RunResult> {
  assertRunnable(scenarios, config);
  const repeat = config.repeat ?? RUN_DEFAULTS.repeat;
  const startedAt = new Date().toISOString();
  const tasks = scenarios.flatMap((loaded) =>
    Array.from({ length: repeat }, (_, index) => ({ loaded, attempt: index + 1 })),
  );

  let done = 0;
  const results = await mapWithLimit(
    tasks,
    config.concurrency ?? RUN_DEFAULTS.concurrency,
    async (task) => {
      const result = await runAttempt(config, task.loaded, task.attempt);
      done += 1;
      onProgress?.(done, tasks.length, result);
      return result;
    },
  );

  const scenarioResults: ScenarioResult[] = scenarios.map((loaded, index) => {
    const attempts = results.slice(index * repeat, (index + 1) * repeat);
    return {
      id: loaded.scenario.id,
      file: loaded.file,
      tags: loaded.scenario.tags,
      status: scenarioStatus(attempts),
      passRate: scenarioPassRate(attempts),
      attempts,
    };
  });

  return {
    version: 1,
    startedAt,
    finishedAt: new Date().toISOString(),
    agent: { name: config.agent.name, model: config.agent.model },
    judge: config.judge === undefined ? null : { model: config.judge.model },
    repeat,
    summary: summarize(scenarioResults),
    scenarios: scenarioResults,
  };
}
