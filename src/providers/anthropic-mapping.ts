import type Anthropic from "@anthropic-ai/sdk";

import type {
  AssistantBlock,
  CompletionRequest,
  CompletionResponse,
  Message,
  StopReason,
} from "./types.js";

type MessageParams = Anthropic.Messages.MessageCreateParamsNonStreaming;

function toMessageParam(message: Message): Anthropic.Messages.MessageParam {
  switch (message.role) {
    case "user":
      return { role: "user", content: message.content };
    case "assistant":
      return {
        role: "assistant",
        content: message.content.map((block) =>
          block.type === "text"
            ? { type: "text", text: block.text }
            : { type: "tool_use", id: block.id, name: block.name, input: block.input },
        ),
      };
    case "tool":
      return {
        role: "user",
        content: message.results.map((result) => ({
          type: "tool_result",
          tool_use_id: result.callId,
          content: result.content,
          is_error: result.isError,
        })),
      };
  }
}

/** Optional parameters are sent only when set: newer models reject `temperature`. */
export function toMessageParams(request: CompletionRequest): MessageParams {
  return {
    model: request.model,
    system: request.system,
    max_tokens: request.maxTokens,
    messages: request.messages.map(toMessageParam),
    tools: request.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: { ...tool.inputSchema, type: "object" },
    })),
    ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
    ...(request.forceTool === undefined
      ? {}
      : { tool_choice: { type: "tool", name: request.forceTool } }),
  };
}

function toBlocks(content: readonly Anthropic.Messages.ContentBlock[]): AssistantBlock[] {
  return content.flatMap((block): AssistantBlock[] => {
    if (block.type === "text") return [{ type: "text", text: block.text }];
    if (block.type !== "tool_use") return [];
    const input = block.input as Record<string, unknown>;
    return [{ type: "tool_call", id: block.id, name: block.name, input }];
  });
}

function toStopReason(reason: Anthropic.Messages.StopReason | null): StopReason {
  if (reason === "end_turn" || reason === "stop_sequence") return "end";
  if (reason === "tool_use") return "tool_use";
  if (reason === "max_tokens") return "max_tokens";
  return "other";
}

/** Keeps text and tool calls; thinking and server tool blocks are not part of the agent's answer. */
export function fromMessage(message: Anthropic.Messages.Message): CompletionResponse {
  return {
    blocks: toBlocks(message.content),
    stopReason: toStopReason(message.stop_reason),
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    },
  };
}
