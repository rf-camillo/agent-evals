import type {
  GuardRejection,
  ModelCallRecord,
  ToolCallRecord,
  Transcript,
  TurnRecord,
} from "./transcript.js";
import { sumUsage } from "./transcript.js";

/**
 * Builds a transcript as the conversation happens, so whatever was recorded
 * survives a timeout, a step limit or a provider failure.
 */
export class TranscriptRecorder {
  private readonly turns: TurnRecord[] = [];
  private readonly said = new Map<TurnRecord, string[]>();

  startTurn(user: string): void {
    const turn: TurnRecord = { user, answer: "", toolCalls: [], modelCalls: [], rejections: [] };
    this.turns.push(turn);
    this.said.set(turn, []);
  }

  recordModelCall(call: ModelCallRecord): void {
    this.current().modelCalls.push(call);
  }

  /** Text the customer sees; it becomes part of the turn's answer. */
  recordText(text: string): void {
    if (text === "") return;
    const turn = this.current();
    const said = this.said.get(turn) ?? [];
    said.push(text);
    turn.answer = said.join("\n\n");
  }

  recordToolCall(call: ToolCallRecord): void {
    this.current().toolCalls.push(call);
  }

  recordRejection(rejection: GuardRejection): void {
    this.current().rejections.push(rejection);
  }

  /** The answer of the current turn if `text` were added to it. */
  answerWith(text: string): string {
    const said = this.said.get(this.current()) ?? [];
    return [...said, text].filter((part) => part !== "").join("\n\n");
  }

  currentToolCalls(): readonly ToolCallRecord[] {
    return this.current().toolCalls;
  }

  snapshot(): Transcript {
    const turns = this.turns.map((turn) => ({
      ...turn,
      toolCalls: [...turn.toolCalls],
      modelCalls: [...turn.modelCalls],
      rejections: [...turn.rejections],
    }));
    const modelCalls = turns.flatMap((turn) => turn.modelCalls);
    return {
      turns,
      usage: sumUsage(modelCalls.map((call) => call.usage)),
      latencyMs: modelCalls.reduce((total, call) => total + call.latencyMs, 0),
    };
  }

  private current(): TurnRecord {
    const turn = this.turns.at(-1);
    if (turn === undefined) throw new Error("No turn has started");
    return turn;
  }
}
