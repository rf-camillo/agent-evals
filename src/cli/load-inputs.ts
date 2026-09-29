import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import type { AgentDefinition } from "../agent/definition.js";
import { errorMessage, EvalError } from "../core/errors.js";
import type { ModelPrice } from "../runner/types.js";
import type { CliEnvironment } from "./environment.js";

function isAgentDefinition(value: unknown): value is AgentDefinition {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<AgentDefinition>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.model === "string" &&
    typeof candidate.system === "string" &&
    typeof candidate.createTools === "function"
  );
}

/** Imports a module whose default export (or `agent` export) is an AgentDefinition. */
export async function loadAgent(file: string, env: CliEnvironment): Promise<AgentDefinition> {
  let module: unknown;
  try {
    module = await env.importModule(path.resolve(env.cwd, file));
  } catch (error) {
    throw new EvalError("INVALID_INPUT", `Cannot import agent ${file}: ${errorMessage(error)}`);
  }
  const exports = (module ?? {}) as { default?: unknown; agent?: unknown };
  const candidate = exports.default ?? exports.agent;
  if (!isAgentDefinition(candidate)) {
    throw new EvalError(
      "INVALID_INPUT",
      `${file} must export an AgentDefinition (name, model, system, createTools) as default`,
    );
  }
  return candidate;
}

const pricesSchema = z.record(
  z.string().min(1),
  z.object({ inputPerMillion: z.number().min(0), outputPerMillion: z.number().min(0) }).strict(),
);

/** Reads `{ "model-id": { "inputPerMillion": 1, "outputPerMillion": 5 } }`. */
export async function loadPrices(
  file: string,
  env: CliEnvironment,
): Promise<Record<string, ModelPrice>> {
  let data: unknown;
  try {
    data = JSON.parse(await readFile(path.resolve(env.cwd, file), "utf8"));
  } catch (error) {
    throw new EvalError("INVALID_INPUT", `Cannot read prices ${file}: ${errorMessage(error)}`);
  }
  const parsed = pricesSchema.safeParse(data);
  if (!parsed.success) {
    throw new EvalError("INVALID_INPUT", `${file} is not a valid price table`);
  }
  return parsed.data;
}
