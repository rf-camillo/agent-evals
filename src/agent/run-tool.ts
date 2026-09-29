import { performance } from "node:perf_hooks";

import { errorMessage } from "../core/errors.js";
import { formatIssues } from "../core/zod-issues.js";
import type { ToolCallBlock } from "../providers/types.js";
import type { AgentTool } from "./definition.js";
import type { ToolCallRecord } from "./transcript.js";

function serialize(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? null);
}

async function execute(
  tool: AgentTool | undefined,
  call: ToolCallBlock,
): Promise<[string, boolean]> {
  if (tool === undefined) return [`Unknown tool "${call.name}"`, true];
  const parsed = tool.input.safeParse(call.input);
  if (!parsed.success) return [`Invalid input: ${formatIssues(parsed.error)}`, true];
  try {
    return [serialize(await tool.run(parsed.data)), false];
  } catch (error) {
    return [errorMessage(error), true];
  }
}

/** Runs one tool call. Failures become error results for the model, never exceptions. */
export async function runToolCall(
  tools: ReadonlyMap<string, AgentTool>,
  call: ToolCallBlock,
): Promise<ToolCallRecord> {
  const started = performance.now();
  const [output, isError] = await execute(tools.get(call.name), call);
  return {
    id: call.id,
    name: call.name,
    input: call.input,
    output,
    isError,
    durationMs: Math.round(performance.now() - started),
  };
}
