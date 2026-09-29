import { allToolCalls } from "../agent/transcript.js";
import { type Check, checkResult } from "./types.js";

export const handoffCheck: Check = ({ scenario, transcript, agent }) => {
  const expected = scenario.expect.handoff;
  if (expected === undefined) return null;
  const tool = agent.handoffTool;
  if (tool === undefined) {
    return checkResult("handoff", [`the agent "${agent.name}" declares no handoffTool`]);
  }
  const handedOff = allToolCalls(transcript).some((call) => call.name === tool && !call.isError);
  if (expected && !handedOff) return checkResult("handoff", [`expected a handoff through ${tool}`]);
  if (!expected && handedOff) {
    return checkResult("handoff", [`handed off through ${tool} without need`]);
  }
  return checkResult("handoff", []);
};
