import { z } from "zod";

import type { Transcript } from "../agent/transcript.js";
import { idSchema } from "../core/ids.js";
import { loadDocuments } from "../core/yaml-documents.js";

const recordedTurn = z
  .object({
    user: z.string().min(1),
    tools: z
      .array(
        z
          .object({
            name: z.string().min(1),
            input: z.record(z.string(), z.unknown()).default({}),
            output: z.string(),
            error: z.boolean().default(false),
          })
          .strict(),
      )
      .default([]),
    agent: z.string(),
  })
  .strict();

export const calibrationCaseSchema = z
  .object({
    id: idSchema,
    description: z.string().optional(),
    rubric: z.string().min(1),
    facts: z.array(z.string().min(1)).default([]),
    conversation: z.array(recordedTurn).min(1),
    expected: z.enum(["pass", "fail"]),
  })
  .strict();

/** A conversation with a known verdict, used to check the judge before trusting it. */
export type CalibrationCase = z.output<typeof calibrationCaseSchema>;

export function caseTranscript(calibrationCase: CalibrationCase): Transcript {
  return {
    turns: calibrationCase.conversation.map((turn, turnIndex) => ({
      user: turn.user,
      answer: turn.agent,
      toolCalls: turn.tools.map((tool, toolIndex) => ({
        id: `recorded_${String(turnIndex)}_${String(toolIndex)}`,
        name: tool.name,
        input: tool.input,
        output: tool.output,
        isError: tool.error,
        durationMs: 0,
      })),
      modelCalls: [],
      rejections: [],
    })),
    usage: { inputTokens: 0, outputTokens: 0 },
    latencyMs: 0,
  };
}

export async function loadCalibrationCases(target: string): Promise<CalibrationCase[]> {
  return (await loadDocuments(target, calibrationCaseSchema)).map(({ value }) => value);
}
