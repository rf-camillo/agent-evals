import { z } from "zod";

import { idSchema } from "../core/ids.js";

const literal = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const argMatcherSchema = z.union([
  literal,
  z.object({ regex: z.string().min(1) }).strict(),
  z.object({ any: z.literal(true) }).strict(),
  z.object({ oneOf: z.array(literal).min(1) }).strict(),
]);

const toolExpectationSchema = z
  .object({
    call: z.string().min(1),
    args: z.record(z.string(), argMatcherSchema).optional(),
  })
  .strict();

const expectationSchema = z
  .object({
    tools: z.array(toolExpectationSchema).default([]),
    ordered: z.boolean().default(false),
    forbidTools: z.array(z.string().min(1)).default([]),
    answer: z
      .object({
        contains: z.array(z.string().min(1)).default([]),
        notContains: z.array(z.string().min(1)).default([]),
      })
      .strict()
      .prefault({}),
    grounded: z.boolean().default(false),
    handoff: z.boolean().optional(),
  })
  .strict();

export const scenarioSchema = z
  .object({
    id: idSchema,
    description: z.string().optional(),
    tags: z.array(z.string().min(1)).default([]),
    turns: z.array(z.object({ user: z.string().min(1) }).strict()).min(1),
    facts: z.array(z.string().min(1)).default([]),
    expect: expectationSchema.prefault({}),
    judge: z
      .object({ rubric: z.string().min(1) })
      .strict()
      .optional(),
  })
  .strict();

/** A validated scenario: user turns, what the agent must do, and an optional judge rubric. */
export type Scenario = z.output<typeof scenarioSchema>;
export type ArgMatcher = z.output<typeof argMatcherSchema>;
export type ToolExpectation = z.output<typeof toolExpectationSchema>;
