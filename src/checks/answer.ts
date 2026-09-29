import { finalAnswer } from "../agent/transcript.js";
import { fold } from "../core/text.js";
import { type Check, checkResult } from "./types.js";

/**
 * `contains` is checked against the final answer; `notContains` against every answer,
 * because a forbidden phrase is a failure whenever the agent says it.
 */
export const answerCheck: Check = ({ scenario, transcript }) => {
  const { contains, notContains } = scenario.expect.answer;
  if (contains.length === 0 && notContains.length === 0) return null;

  const final = fold(finalAnswer(transcript));
  const everything = fold(transcript.turns.map((turn) => turn.answer).join("\n"));
  const missing = contains
    .filter((phrase) => !final.includes(fold(phrase)))
    .map((phrase) => `final answer does not mention "${phrase}"`);
  const present = notContains
    .filter((phrase) => everything.includes(fold(phrase)))
    .map((phrase) => `an answer mentions "${phrase}"`);
  return checkResult("answer", [...missing, ...present]);
};
