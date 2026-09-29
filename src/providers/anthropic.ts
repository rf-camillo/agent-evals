import Anthropic from "@anthropic-ai/sdk";

import { errorMessage, EvalError } from "../core/errors.js";
import { fromMessage, toMessageParams } from "./anthropic-mapping.js";
import type { CompletionRequest, CompletionResponse, Provider } from "./types.js";

export type MessagesClient = Pick<Anthropic["messages"], "create">;

export interface AnthropicProviderOptions {
  /** Defaults to the `ANTHROPIC_API_KEY` environment variable. */
  apiKey?: string;
  /** Replaces the SDK client, for tests. */
  client?: { messages: MessagesClient };
}

/** Calls Claude through the official Anthropic SDK. */
export class AnthropicProvider implements Provider {
  readonly name = "anthropic";
  private readonly messages: MessagesClient;

  constructor(options: AnthropicProviderOptions = {}) {
    const client =
      options.client ??
      new Anthropic(options.apiKey === undefined ? {} : { apiKey: options.apiKey });
    this.messages = client.messages;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const message = await this.messages.create(
        toMessageParams(request),
        request.signal === undefined ? undefined : { signal: request.signal },
      );
      return fromMessage(message);
    } catch (error) {
      throw new EvalError("PROVIDER_ERROR", `Anthropic request failed: ${errorMessage(error)}`, {
        cause: error,
      });
    }
  }
}
