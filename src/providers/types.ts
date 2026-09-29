export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolCallBlock {
  type: "tool_call";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type AssistantBlock = TextBlock | ToolCallBlock;

export interface ToolResult {
  callId: string;
  content: string;
  isError: boolean;
}

export type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; content: AssistantBlock[] }
  | { role: "tool"; results: ToolResult[] };

export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface CompletionRequest {
  model: string;
  system: string;
  messages: readonly Message[];
  tools: readonly ToolSpec[];
  maxTokens: number;
  /** Sent only when set; some models reject the parameter. */
  temperature?: number;
  /** Forces the model to answer by calling this tool, for structured output. */
  forceTool?: string;
  signal?: AbortSignal;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export type StopReason = "end" | "tool_use" | "max_tokens" | "other";

export interface CompletionResponse {
  blocks: AssistantBlock[];
  stopReason: StopReason;
  usage: Usage;
}

/** A model API reduced to one call. Implement it to evaluate agents on another provider. */
export interface Provider {
  readonly name: string;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}
