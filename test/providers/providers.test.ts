import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";

import { AnthropicProvider, type MessagesClient } from "../../src/providers/anthropic.js";
import { textOf, toolCallsOf } from "../../src/providers/blocks.js";
import { ScriptedProvider, text, toolCall } from "../../src/providers/scripted.js";
import type { CompletionRequest } from "../../src/providers/types.js";

const REQUEST: CompletionRequest = {
  model: "claude-haiku-4-5",
  system: "Be brief.",
  messages: [
    { role: "user", content: "Weather in Lisbon?" },
    {
      role: "assistant",
      content: [
        text("Checking."),
        { type: "tool_call", id: "t1", name: "get_forecast", input: { city: "Lisbon" } },
      ],
    },
    { role: "tool", results: [{ callId: "t1", content: '{"high":24}', isError: false }] },
  ],
  tools: [
    {
      name: "get_forecast",
      description: "Forecast",
      inputSchema: { properties: { city: { type: "string" } } },
    },
  ],
  maxTokens: 256,
  temperature: 0,
};

function fakeClient(response: Partial<Anthropic.Messages.Message> | Error) {
  const calls: unknown[][] = [];
  const client = {
    messages: {
      create: (...args: unknown[]) => {
        calls.push(args);
        return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
      },
    } as unknown as MessagesClient,
  };
  return { client, calls };
}

describe("AnthropicProvider", () => {
  it("maps messages, tools and the response", async () => {
    const { client, calls } = fakeClient({
      content: [
        { type: "text", text: "Sunny, 24°C.", citations: null },
        {
          type: "tool_use",
          id: "t2",
          name: "get_forecast",
          input: { city: "Porto" },
          caller: { type: "direct" },
        },
      ],
      stop_reason: "tool_use",
      usage: { input_tokens: 50, output_tokens: 12 } as Anthropic.Messages.Usage,
    });
    const response = await new AnthropicProvider({ client }).complete(REQUEST);

    expect(calls[0]?.[0]).toMatchObject({
      model: "claude-haiku-4-5",
      system: "Be brief.",
      max_tokens: 256,
      temperature: 0,
      messages: [
        { role: "user", content: "Weather in Lisbon?" },
        {
          role: "assistant",
          content: [
            { type: "text", text: "Checking." },
            { type: "tool_use", id: "t1", name: "get_forecast", input: { city: "Lisbon" } },
          ],
        },
        {
          role: "user",
          content: [
            { type: "tool_result", tool_use_id: "t1", content: '{"high":24}', is_error: false },
          ],
        },
      ],
      tools: [
        {
          name: "get_forecast",
          input_schema: { type: "object", properties: { city: { type: "string" } } },
        },
      ],
    });
    expect(response).toEqual({
      blocks: [
        text("Sunny, 24°C."),
        { type: "tool_call", id: "t2", name: "get_forecast", input: { city: "Porto" } },
      ],
      stopReason: "tool_use",
      usage: { inputTokens: 50, outputTokens: 12 },
    });
  });

  it.each([
    ["end_turn", "end"],
    ["stop_sequence", "end"],
    ["max_tokens", "max_tokens"],
    ["refusal", "other"],
  ] as const)("maps stop reason %s to %s", async (reason, expected) => {
    const { client } = fakeClient({
      content: [],
      stop_reason: reason,
      usage: { input_tokens: 1, output_tokens: 1 } as Anthropic.Messages.Usage,
    });
    expect((await new AnthropicProvider({ client }).complete(REQUEST)).stopReason).toBe(expected);
  });

  it("forces a tool, forwards the abort signal and leaves unset options out", async () => {
    const { client, calls } = fakeClient({
      content: [{ type: "redacted_thinking", data: "…" }],
      stop_reason: "tool_use",
      usage: { input_tokens: 1, output_tokens: 1 } as Anthropic.Messages.Usage,
    });
    const controller = new AbortController();
    const request: CompletionRequest = {
      ...REQUEST,
      forceTool: "get_forecast",
      signal: controller.signal,
    };
    delete request.temperature;
    const response = await new AnthropicProvider({ client }).complete(request);

    expect(calls[0]?.[0]).toMatchObject({ tool_choice: { type: "tool", name: "get_forecast" } });
    expect(calls[0]?.[0]).not.toHaveProperty("temperature");
    expect(calls[0]?.[1]).toEqual({ signal: controller.signal });
    expect(response.blocks).toEqual([]);
  });

  it("creates its own client from an API key", () => {
    expect(new AnthropicProvider({ apiKey: "test-key" }).name).toBe("anthropic");
  });

  it("describes failures that are not errors", async () => {
    const client = {
      messages: {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- anything can be thrown
        create: () => Promise.reject("503 overloaded"),
      } as unknown as MessagesClient,
    };
    await expect(new AnthropicProvider({ client }).complete(REQUEST)).rejects.toMatchObject({
      message: "Anthropic request failed: 503 overloaded",
    });
  });

  it("wraps API failures as provider errors", async () => {
    const { client } = fakeClient(new Error("401 invalid x-api-key"));
    await expect(new AnthropicProvider({ client }).complete(REQUEST)).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
      message: "Anthropic request failed: 401 invalid x-api-key",
    });
  });
});

describe("ScriptedProvider", () => {
  it("replays a sequence and records the requests", async () => {
    const provider = ScriptedProvider.sequence([
      [toolCall("get_forecast", { city: "Lisbon" })],
      [text("Sunny.")],
    ]);
    expect((await provider.complete(REQUEST)).stopReason).toBe("tool_use");
    expect((await provider.complete(REQUEST)).stopReason).toBe("end");
    expect(provider.requests).toHaveLength(2);
    await expect(provider.complete(REQUEST)).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
  });

  it("gives every tool call a unique id", () => {
    expect(toolCall("a").type === "tool_call" && toolCall("a")).not.toEqual(toolCall("a"));
  });
});

describe("block helpers", () => {
  it("joins text and extracts tool calls", () => {
    const blocks = [text("One."), toolCall("x"), text("Two.")];
    expect(textOf(blocks)).toBe("One.\nTwo.");
    expect(toolCallsOf(blocks).map((call) => call.name)).toEqual(["x"]);
  });
});
