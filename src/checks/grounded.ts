import { allToolCalls } from "../agent/transcript.js";
import { evidenceValues, extractClaims } from "./claims.js";
import { type Check, checkResult } from "./types.js";

/**
 * Every price, clock time and date the agent states must appear in a tool result,
 * in the scenario's facts or in what the user said. Tool inputs do not count:
 * the model wrote them, so they prove nothing.
 */
export const groundedCheck: Check = ({ scenario, transcript }) => {
  if (!scenario.expect.grounded) return null;

  const evidence = evidenceValues(
    [
      ...allToolCalls(transcript)
        .filter((call) => !call.isError)
        .map((call) => call.output),
      ...scenario.facts,
      ...transcript.turns.map((turn) => turn.user),
    ].join("\n"),
  );
  const unsupported = transcript.turns.flatMap((turn) =>
    extractClaims(turn.answer).filter((claim) => !evidence.has(`${claim.kind}:${claim.value}`)),
  );
  return checkResult(
    "grounded",
    unsupported.map(
      (claim) => `${claim.kind} "${claim.text}" is not backed by a tool result, a fact or the user`,
    ),
  );
};
