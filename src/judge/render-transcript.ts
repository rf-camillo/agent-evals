import type { Transcript } from "../agent/transcript.js";
import { JUDGE_DEFAULTS } from "./defaults.js";

const CONVERSATION_TAG = "conversation";

function clip(text: string): string {
  const max = JUDGE_DEFAULTS.maxToolOutputChars;
  return text.length <= max ? text : `${text.slice(0, max)}… (truncated)`;
}

/** Neutralizes the delimiter tags, so text from the conversation cannot close them. */
function neutralize(text: string): string {
  return text.replace(new RegExp(`<(/?)${CONVERSATION_TAG}>`, "gi"), "‹$1${CONVERSATION_TAG}›");
}

function renderTurns(transcript: Transcript): string {
  return transcript.turns
    .map((turn, index) => {
      const lines = [`## Turn ${String(index + 1)}`, `USER: ${turn.user}`];
      for (const call of turn.toolCalls) {
        lines.push(`TOOL CALL ${call.name} ${JSON.stringify(call.input)}`);
        lines.push(`TOOL ${call.isError ? "ERROR" : "RESULT"}: ${clip(call.output)}`);
      }
      lines.push(`AGENT: ${turn.answer}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

/**
 * Renders a conversation for the judge between `<conversation>` tags. Everything inside
 * is data to grade; the agent cannot break out of it by writing the closing tag.
 */
export function renderTranscript(transcript: Transcript): string {
  return `<${CONVERSATION_TAG}>\n${neutralize(renderTurns(transcript))}\n</${CONVERSATION_TAG}>`;
}
