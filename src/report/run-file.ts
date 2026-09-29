import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { errorMessage, EvalError } from "../core/errors.js";
import type { RunResult } from "../runner/types.js";

export async function saveRun(result: RunResult, file: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

function isRunResult(value: unknown): value is RunResult {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<RunResult>;
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.scenarios) &&
    typeof candidate.summary === "object"
  );
}

/** Reads a run saved with {@link saveRun}; refuses files from another format or version. */
export async function loadRun(file: string): Promise<RunResult> {
  let data: unknown;
  try {
    data = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new EvalError("INVALID_FILE", `Cannot read run ${file}: ${errorMessage(error)}`);
  }
  if (!isRunResult(data)) {
    throw new EvalError("INVALID_FILE", `${file} is not an agent-evals run (version 1)`);
  }
  return data;
}
