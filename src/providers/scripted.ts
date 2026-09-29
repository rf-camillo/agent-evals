import { randomUUID } from "node:crypto";

import { EvalError } from "../core/errors.js";
import type {
  AssistantBlock,
  CompletionRequest,
  CompletionResponse,
  Provider,
  Usage,
} from "./types.js";

export type ScriptedReply = (
  request: CompletionRequest,
) => AssistantBlock[] | Promise<AssistantBlock[]>;

const DEFAULT_USAGE: Usage = { inputTokens: 100, outputTokens: 20 };

export function text(value: string): AssistantBlock {
  return { type: "text", text: value };
}

export function toolCall(name: string, input: Record<string, unknown> = {}): AssistantBlock {
  return { type: "tool_call", id: `call_${randomUUID()}`, name, input };
}

/**
 * A provider that answers from a function instead of a model.
 * Used by the tests and to run evaluations offline.
 */
export class ScriptedProvider implements Provider {
  readonly name = "scripted";
  readonly requests: CompletionRequest[] = [];
  private readonly reply: ScriptedReply;
  private readonly usage: Usage;

  constructor(reply: ScriptedReply, usage: Usage = DEFAULT_USAGE) {
    this.reply = reply;
    this.usage = usage;
  }

  /** Answers with each reply in turn and fails when they run out. */
  static sequence(replies: readonly AssistantBlock[][], usage?: Usage): ScriptedProvider {
    let index = 0;
    return new ScriptedProvider(() => {
      const next = replies[index];
      index += 1;
      if (next === undefined) {
        throw new EvalError("PROVIDER_ERROR", "Scripted provider ran out of replies");
      }
      return next;
    }, usage);
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    this.requests.push(request);
    const blocks = await this.reply(request);
    const stopReason = blocks.some((block) => block.type === "tool_call") ? "tool_use" : "end";
    return { blocks, stopReason, usage: this.usage };
  }
}
