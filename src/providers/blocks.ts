import type { AssistantBlock, TextBlock, ToolCallBlock } from "./types.js";

export function textOf(blocks: readonly AssistantBlock[]): string {
  return blocks
    .filter((block): block is TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

export function toolCallsOf(blocks: readonly AssistantBlock[]): ToolCallBlock[] {
  return blocks.filter((block): block is ToolCallBlock => block.type === "tool_call");
}
