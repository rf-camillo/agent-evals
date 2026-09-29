import type { Transcript } from "../../src/agent/transcript.js";
import { type Scenario, scenarioSchema } from "../../src/scenarios/schema.js";

export interface CallSpec {
  name: string;
  input?: Record<string, unknown>;
  output?: string;
  isError?: boolean;
}

export interface TurnSpec {
  user?: string;
  answer: string;
  calls?: CallSpec[];
}

export function transcript(...turns: TurnSpec[]): Transcript {
  return {
    turns: turns.map((turn, index) => ({
      user: turn.user ?? `turn ${String(index + 1)}`,
      answer: turn.answer,
      toolCalls: (turn.calls ?? []).map((call, callIndex) => ({
        id: `call_${String(index)}_${String(callIndex)}`,
        name: call.name,
        input: call.input ?? {},
        output: call.output ?? "ok",
        isError: call.isError ?? false,
        durationMs: 1,
      })),
      modelCalls: [],
      rejections: [],
    })),
    usage: { inputTokens: 0, outputTokens: 0 },
    latencyMs: 0,
  };
}

export function scenario(fields: Record<string, unknown> = {}): Scenario {
  return scenarioSchema.parse({ id: "test", turns: [{ user: "Hi" }], ...fields });
}
