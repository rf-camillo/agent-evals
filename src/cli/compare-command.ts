import { writeFile } from "node:fs/promises";
import path from "node:path";

import { compareRuns, DEFAULT_MAX_DROP } from "../report/compare.js";
import { renderComparison } from "../report/compare-markdown.js";
import { loadRun } from "../report/run-file.js";
import type { Command } from "./command.js";
import { ratioFlag, requireArg } from "./flags.js";

export const compareCommand: Command = async ([baselineFile, candidateFile], values, env) => {
  const baseline = await loadRun(
    path.resolve(env.cwd, requireArg(baselineFile, "the baseline run")),
  );
  const candidate = await loadRun(
    path.resolve(env.cwd, requireArg(candidateFile, "the candidate run")),
  );
  const maxDrop = ratioFlag(values["max-drop"], "max-drop") ?? DEFAULT_MAX_DROP;
  const comparison = compareRuns(baseline, candidate, maxDrop);
  const markdown = renderComparison(comparison);
  if (values.markdown !== undefined) {
    await writeFile(path.resolve(env.cwd, values.markdown), markdown, "utf8");
  }
  return { code: comparison.failed ? 1 : 0, output: markdown.trimEnd() };
};
