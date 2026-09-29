import type { StopReason, Usage } from "../providers/types.js";

export interface ToolCallRecord {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output: string;
  isError: boolean;
  durationMs: number;
}

export interface ModelCallRecord {
  usage: Usage;
  latencyMs: number;
  stopReason: StopReason;
}

/** An answer a guard stopped, and why. The customer never saw it. */
export interface GuardRejection {
  answer: string;
  feedback: string;
}

export interface TurnRecord {
  user: string;
  answer: string;
  toolCalls: ToolCallRecord[];
  modelCalls: ModelCallRecord[];
  rejections: GuardRejection[];
}

/** Everything that happened in one conversation, turn by turn. */
export interface Transcript {
  turns: TurnRecord[];
  usage: Usage;
  latencyMs: number;
}

export function allToolCalls(transcript: Transcript): ToolCallRecord[] {
  return transcript.turns.flatMap((turn) => turn.toolCalls);
}

export function finalAnswer(transcript: Transcript): string {
  return transcript.turns.at(-1)?.answer ?? "";
}

export function sumUsage(usages: readonly Usage[]): Usage {
  return usages.reduce(
    (total, usage) => ({
      inputTokens: total.inputTokens + usage.inputTokens,
      outputTokens: total.outputTokens + usage.outputTokens,
    }),
    { inputTokens: 0, outputTokens: 0 },
  );
}
