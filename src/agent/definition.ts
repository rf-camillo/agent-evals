import { z } from "zod";

import type { ToolSpec } from "../providers/types.js";
import type { ToolCallRecord } from "./transcript.js";

/** A tool the agent under test can call, with a zod schema for its input. */
export interface AgentTool<Input extends z.ZodObject = z.ZodObject> {
  name: string;
  description: string;
  input: Input;
  run(input: z.output<Input>): unknown;
}

/** What a guard sees: the answer the agent is about to give and the tool calls of this turn. */
export interface GuardInput {
  user: string;
  answer: string;
  toolCalls: readonly ToolCallRecord[];
}

/**
 * Code that checks an answer before the customer would see it. Returns `null` to let it
 * through, or feedback that goes back to the model, which then tries again.
 */
export type AnswerGuard = (input: GuardInput) => string | null;

/** The agent under test: model, system prompt and a fresh set of tools per conversation. */
export interface AgentDefinition {
  name: string;
  model: string;
  system: string;
  /** Creates the tools for one conversation, so state never leaks between scenarios. */
  createTools(): AgentTool[];
  /** The tool that hands the conversation to a human, checked by `expect.handoff`. */
  handoffTool?: string;
  /** Checks run on every final answer; a rejected answer is never shown to the customer. */
  guards?: readonly AnswerGuard[];
  /** Model calls allowed per user turn before the conversation fails. Defaults to 8. */
  maxSteps?: number;
  maxTokens?: number;
  /** Sent to the model only when set; newer models reject it. */
  temperature?: number;
}

export const AGENT_DEFAULTS = { maxSteps: 8, maxTokens: 1024 } as const;

/** Declares a tool with type inference for its input. */
export function defineAgentTool<Input extends z.ZodObject>(tool: AgentTool<Input>): AgentTool {
  return tool;
}

export function toToolSpec(tool: AgentTool): ToolSpec {
  const inputSchema = { ...(z.toJSONSchema(tool.input) as Record<string, unknown>) };
  delete inputSchema.$schema;
  return { name: tool.name, description: tool.description, inputSchema };
}
