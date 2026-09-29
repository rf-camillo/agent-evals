import { performance } from "node:perf_hooks";

import { z } from "zod";

import { toolCallsOf } from "../providers/blocks.js";
import type { Provider, Usage } from "../providers/types.js";
import { JUDGE_DEFAULTS } from "./defaults.js";
import { JudgeError } from "./judge-error.js";
import { JUDGE_SYSTEM, type JudgeInput, judgePrompt, VERDICT_TOOL } from "./prompt.js";

const verdictSchema = z.object({
  reasoning: z.string().min(1),
  verdict: z.enum(["pass", "fail"]),
});

export type Verdict = z.output<typeof verdictSchema>["verdict"];

/** The judge's decision on one conversation. */
export interface JudgeResult {
  verdict: Verdict;
  reasoning: string;
  usage: Usage;
  latencyMs: number;
}

/** The model that grades conversations. Use a stronger model than the agent's. */
export interface JudgeConfig {
  provider: Provider;
  model: string;
  maxTokens?: number;
}

/**
 * Asks the judge for a verdict. Anything but a well-formed verdict is a JUDGE_ERROR,
 * never a pass: a broken instrument must not look like a good result.
 */
export async function judge(config: JudgeConfig, input: JudgeInput): Promise<JudgeResult> {
  const started = performance.now();
  const response = await config.provider.complete({
    model: config.model,
    system: JUDGE_SYSTEM,
    messages: [{ role: "user", content: judgePrompt(input) }],
    tools: [VERDICT_TOOL],
    forceTool: VERDICT_TOOL.name,
    maxTokens: config.maxTokens ?? JUDGE_DEFAULTS.maxTokens,
  });
  const call = toolCallsOf(response.blocks).find((block) => block.name === VERDICT_TOOL.name);
  if (call === undefined) {
    throw new JudgeError("The judge answered without recording a verdict", response.usage);
  }
  const parsed = verdictSchema.safeParse(call.input);
  if (!parsed.success) {
    throw new JudgeError(
      `The judge recorded a malformed verdict: ${JSON.stringify(call.input)}`,
      response.usage,
    );
  }
  return {
    ...parsed.data,
    usage: response.usage,
    latencyMs: Math.round(performance.now() - started),
  };
}
