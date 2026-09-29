import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { defineAgentTool } from "../../src/agent/definition.js";
import { runToolCall } from "../../src/agent/run-tool.js";
import { finalAnswer, sumUsage } from "../../src/agent/transcript.js";
import { errorMessage, EvalError } from "../../src/core/errors.js";
import { AnthropicProvider, type MessagesClient } from "../../src/providers/anthropic.js";

describe("edge cases", () => {
  it("passes string tool results through and serializes undefined as null", async () => {
    const tools = new Map([
      [
        "echo",
        defineAgentTool({ name: "echo", description: "", input: z.object({}), run: () => "plain" }),
      ],
      [
        "noop",
        defineAgentTool({
          name: "noop",
          description: "",
          input: z.object({}),
          run: () => undefined,
        }),
      ],
    ]);
    const call = (name: string) =>
      runToolCall(tools, { type: "tool_call", id: name, name, input: {} });
    expect((await call("echo")).output).toBe("plain");
    expect((await call("noop")).output).toBe("null");
  });

  it("treats an empty transcript as an empty answer", () => {
    expect(finalAnswer({ turns: [], usage: sumUsage([]), latencyMs: 0 })).toBe("");
  });

  it("describes any thrown value", () => {
    expect(errorMessage(new EvalError("TIMEOUT", "slow"))).toBe("slow");
    expect(errorMessage("plain string")).toBe("plain string");
  });

  it("ignores non-text blocks and forwards the abort signal", async () => {
    const received: unknown[] = [];
    const client = {
      messages: {
        create: (params: unknown, options: unknown) => {
          received.push(options);
          return Promise.resolve({
            content: [{ type: "thinking", thinking: "…", signature: "s" }],
            stop_reason: null,
            usage: { input_tokens: 1, output_tokens: 1 },
          } as unknown as Anthropic.Messages.Message);
        },
      } as unknown as MessagesClient,
    };
    const controller = new AbortController();
    const response = await new AnthropicProvider({ client }).complete({
      model: "m",
      system: "",
      messages: [],
      tools: [],
      maxTokens: 1,
      temperature: 0,
      signal: controller.signal,
    });
    expect(response.blocks).toEqual([]);
    expect(response.stopReason).toBe("other");
    expect(received[0]).toEqual({ signal: controller.signal });
  });

  it("forces a tool when asked", async () => {
    const received: Record<string, unknown>[] = [];
    const client = {
      messages: {
        create: (params: Record<string, unknown>) => {
          received.push(params);
          return Promise.resolve({
            content: [],
            stop_reason: "end_turn",
            usage: { input_tokens: 1, output_tokens: 1 },
          } as unknown as Anthropic.Messages.Message);
        },
      } as unknown as MessagesClient,
    };
    const base = { model: "m", system: "", messages: [], tools: [], maxTokens: 1 };
    await new AnthropicProvider({ client }).complete({ ...base, forceTool: "record_verdict" });
    await new AnthropicProvider({ client }).complete({ ...base, temperature: 0 });
    await new AnthropicProvider({ client }).complete(base);
    expect(received[0]?.tool_choice).toEqual({ type: "tool", name: "record_verdict" });
    expect(received[1]).not.toHaveProperty("tool_choice");
    expect(received[1]?.temperature).toBe(0);
    expect(received[2]).not.toHaveProperty("temperature");
  });

  it("builds a real SDK client from an explicit key", () => {
    expect(new AnthropicProvider({ apiKey: "test-key" }).name).toBe("anthropic");
  });
});
