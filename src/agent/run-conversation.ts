import { performance } from "node:perf_hooks";

import { EvalError } from "../core/errors.js";
import { textOf, toolCallsOf } from "../providers/blocks.js";
import type { CompletionResponse, Message, Provider } from "../providers/types.js";
import { AGENT_DEFAULTS, type AgentDefinition, type AgentTool, toToolSpec } from "./definition.js";
import { firstRejection, guardMessage } from "./guards.js";
import { runToolCall } from "./run-tool.js";
import type { Transcript } from "./transcript.js";
import { TranscriptRecorder } from "./transcript-recorder.js";

export interface ConversationOptions {
  signal?: AbortSignal;
  /** Receives every event as it happens; pass one to keep a partial transcript on failure. */
  recorder?: TranscriptRecorder;
}

interface Session {
  agent: AgentDefinition;
  provider: Provider;
  tools: ReadonlyMap<string, AgentTool>;
  messages: Message[];
  recorder: TranscriptRecorder;
  signal: AbortSignal | undefined;
}

async function callModel(session: Session): Promise<[CompletionResponse, number]> {
  const { agent, provider, tools, messages, signal } = session;
  const started = performance.now();
  const response = await provider.complete({
    model: agent.model,
    system: agent.system,
    messages: [...messages],
    tools: [...tools.values()].map(toToolSpec),
    maxTokens: agent.maxTokens ?? AGENT_DEFAULTS.maxTokens,
    ...(agent.temperature === undefined ? {} : { temperature: agent.temperature }),
    ...(signal === undefined ? {} : { signal }),
  });
  return [response, Math.round(performance.now() - started)];
}

/**
 * Plays one user turn until the agent gives an answer its guards accept. Tools run one at a
 * time, in the order the model asked for, so stateful backends behave reproducibly. A rejected
 * answer is recorded but never becomes part of what the customer saw.
 */
async function runTurn(session: Session, user: string): Promise<void> {
  const maxSteps = session.agent.maxSteps ?? AGENT_DEFAULTS.maxSteps;
  session.recorder.startTurn(user);
  session.messages.push({ role: "user", content: user });

  for (let step = 0; step < maxSteps; step += 1) {
    const [response, latencyMs] = await callModel(session);
    session.recorder.recordModelCall({
      usage: response.usage,
      latencyMs,
      stopReason: response.stopReason,
    });
    session.messages.push({ role: "assistant", content: response.blocks });

    const text = textOf(response.blocks);
    const calls = toolCallsOf(response.blocks);
    if (calls.length === 0) {
      const feedback = firstRejection(session.agent.guards ?? [], {
        user,
        answer: session.recorder.answerWith(text),
        toolCalls: session.recorder.currentToolCalls(),
      });
      if (feedback === null) {
        session.recorder.recordText(text);
        return;
      }
      session.recorder.recordRejection({ answer: text, feedback });
      session.messages.push({ role: "user", content: guardMessage(feedback) });
      continue;
    }
    session.recorder.recordText(text);
    const results = [];
    for (const call of calls) {
      const record = await runToolCall(session.tools, call);
      session.recorder.recordToolCall(record);
      results.push({ callId: record.id, content: record.output, isError: record.isError });
    }
    session.messages.push({ role: "tool", results });
  }
  throw new EvalError(
    "MAX_STEPS",
    `The agent made ${String(maxSteps)} model calls without answering "${user}"`,
  );
}

/** Plays the user turns against the agent, running its tools, and records everything. */
export async function runConversation(
  agent: AgentDefinition,
  provider: Provider,
  userTurns: readonly string[],
  options: ConversationOptions = {},
): Promise<Transcript> {
  const session: Session = {
    agent,
    provider,
    tools: new Map(agent.createTools().map((tool) => [tool.name, tool])),
    messages: [],
    recorder: options.recorder ?? new TranscriptRecorder(),
    signal: options.signal,
  };
  for (const user of userTurns) await runTurn(session, user);
  return session.recorder.snapshot();
}
