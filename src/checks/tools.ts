import { allToolCalls, type ToolCallRecord } from "../agent/transcript.js";
import type { ToolExpectation } from "../scenarios/schema.js";
import { argMismatches } from "./match-args.js";
import { type Check, checkResult } from "./types.js";

function satisfies(call: ToolCallRecord, expectation: ToolExpectation): boolean {
  return (
    call.name === expectation.call && argMismatches(expectation.args ?? {}, call.input).length === 0
  );
}

function explainMiss(calls: readonly ToolCallRecord[], expectation: ToolExpectation): string {
  const sameName = calls.filter((call) => call.name === expectation.call);
  if (sameName.length === 0) return `${expectation.call} was never called`;
  const closest = sameName
    .map((call) => argMismatches(expectation.args ?? {}, call.input))
    .reduce((best, current) => (current.length < best.length ? current : best));
  return `${expectation.call} was called with other arguments (${closest.join("; ")})`;
}

function unorderedFailures(
  calls: readonly ToolCallRecord[],
  expected: readonly ToolExpectation[],
): string[] {
  const available = [...calls];
  return expected.flatMap((expectation) => {
    const index = available.findIndex((call) => satisfies(call, expectation));
    if (index >= 0) {
      available.splice(index, 1);
      return [];
    }
    return [explainMiss(calls, expectation)];
  });
}

function orderedFailures(
  calls: readonly ToolCallRecord[],
  expected: readonly ToolExpectation[],
): string[] {
  let position = 0;
  for (const [index, expectation] of expected.entries()) {
    const found = calls.findIndex((call, at) => at >= position && satisfies(call, expectation));
    if (found < 0) {
      const previous = expected[index - 1];
      const tooEarly = previous !== undefined && calls.some((call) => satisfies(call, expectation));
      return [
        tooEarly
          ? `${expectation.call} was called before ${previous.call}, expected after`
          : explainMiss(calls, expectation),
      ];
    }
    position = found + 1;
  }
  return [];
}

export const toolsCheck: Check = ({ scenario, transcript }) => {
  const { tools, ordered } = scenario.expect;
  if (tools.length === 0) return null;
  const calls = allToolCalls(transcript);
  return checkResult(
    "tools",
    ordered ? orderedFailures(calls, tools) : unorderedFailures(calls, tools),
  );
};

export const forbiddenToolsCheck: Check = ({ scenario, transcript }) => {
  const forbidden = new Set(scenario.expect.forbidTools);
  if (forbidden.size === 0) return null;
  const called = allToolCalls(transcript).filter((call) => forbidden.has(call.name));
  return checkResult(
    "forbiddenTools",
    called.map((call) => `${call.name} must not be called (input ${JSON.stringify(call.input)})`),
  );
};
