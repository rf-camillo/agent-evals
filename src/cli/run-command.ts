import { writeFile } from "node:fs/promises";
import path from "node:path";

import { EvalError } from "../core/errors.js";
import { renderMarkdown } from "../report/markdown.js";
import { saveRun } from "../report/run-file.js";
import { renderTerminal } from "../report/terminal.js";
import { runEvals } from "../runner/run-evals.js";
import type { RunConfig, RunResult } from "../runner/types.js";
import { loadScenarios } from "../scenarios/load.js";
import type { Command } from "./command.js";
import type { CliEnvironment } from "./environment.js";
import { integerFlag, ratioFlag, requireArg } from "./flags.js";
import { loadAgent, loadPrices } from "./load-inputs.js";
import type { CliValues } from "./options.js";

async function buildConfig(values: CliValues, env: CliEnvironment): Promise<RunConfig> {
  const agent = await loadAgent(requireArg(values.agent, "--agent"), env);
  const provider = env.createProvider();
  const judgeModel = values["judge-model"];
  const repeat = integerFlag(values.repeat, "repeat");
  const concurrency = integerFlag(values.concurrency, "concurrency");
  const timeoutMs = integerFlag(values.timeout, "timeout");
  return {
    agent: values.model === undefined ? agent : { ...agent, model: values.model },
    provider,
    ...(judgeModel === undefined ? {} : { judge: { provider, model: judgeModel } }),
    ...(repeat === undefined ? {} : { repeat }),
    ...(concurrency === undefined ? {} : { concurrency }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
    ...(values.prices === undefined ? {} : { prices: await loadPrices(values.prices, env) }),
  };
}

async function writeOutputs(
  result: RunResult,
  values: CliValues,
  env: CliEnvironment,
): Promise<string[]> {
  const written: string[] = [];
  if (values.out !== undefined) {
    await saveRun(result, path.resolve(env.cwd, values.out));
    written.push(`Saved ${values.out}`);
  }
  if (values.markdown !== undefined) {
    await writeFile(path.resolve(env.cwd, values.markdown), renderMarkdown(result), "utf8");
    written.push(`Wrote ${values.markdown}`);
  }
  return written;
}

function passes(result: RunResult, minPassRate: number | undefined): boolean {
  if (result.summary.errors > 0) return false;
  return minPassRate === undefined || result.summary.passRate >= minPassRate;
}

export const runCommand: Command = async ([target], values, env) => {
  const minPassRate = ratioFlag(values["min-pass-rate"], "min-pass-rate");
  const tags = values.tag ?? [];
  const loaded = await loadScenarios(
    path.resolve(env.cwd, requireArg(target, "the scenarios path")),
  );
  const all = loaded.map((item) => ({ ...item, file: path.relative(env.cwd, item.file) }));
  const scenarios =
    tags.length === 0
      ? all
      : all.filter(({ scenario }) => scenario.tags.some((tag) => tags.includes(tag)));
  if (scenarios.length === 0) {
    throw new EvalError("INVALID_INPUT", `No scenarios tagged ${tags.join(", ")}`);
  }

  const config = await buildConfig(values, env);
  const result = await runEvals(scenarios, config, (done, total, attempt) => {
    env.log(`[${String(done)}/${String(total)}] ${attempt.status}`);
  });
  const written = await writeOutputs(result, values, env);
  return {
    code: passes(result, minPassRate) ? 0 : 1,
    output: [renderTerminal(result), ...written].join("\n"),
  };
};
