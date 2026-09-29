import path from "node:path";

import type { AgentDefinition } from "../agent/definition.js";
import type { LoadedScenario } from "../scenarios/load.js";
import { loadScenarios } from "../scenarios/load.js";
import type { Command } from "./command.js";
import { requireArg } from "./flags.js";
import { loadAgent } from "./load-inputs.js";

/** Problems that would make a scenario fail for reasons unrelated to the agent's behavior. */
export function scenarioProblems(
  loaded: readonly LoadedScenario[],
  agent: AgentDefinition,
): string[] {
  const tools = new Set(agent.createTools().map((tool) => tool.name));
  return loaded.flatMap(({ scenario }) => {
    const referenced = [
      ...scenario.expect.tools.map((tool) => tool.call),
      ...scenario.expect.forbidTools,
    ];
    const unknown = [...new Set(referenced)].filter((name) => !tools.has(name));
    const problems = unknown.map((name) => `${scenario.id}: the agent has no tool "${name}"`);
    if (scenario.expect.handoff !== undefined && agent.handoffTool === undefined) {
      problems.push(`${scenario.id}: expects a handoff but the agent declares no handoffTool`);
    }
    return problems;
  });
}

export const validateCommand: Command = async ([target], values, env) => {
  const loaded = await loadScenarios(
    path.resolve(env.cwd, requireArg(target, "the scenarios path")),
  );
  const problems =
    values.agent === undefined ? [] : scenarioProblems(loaded, await loadAgent(values.agent, env));
  const header = `${String(loaded.length)} scenarios valid${values.agent === undefined ? "" : ` for ${values.agent}`}`;
  if (problems.length === 0) return { code: 0, output: `✅ ${header}` };
  return {
    code: 1,
    output: [
      `❌ ${String(problems.length)} problems`,
      ...problems.map((problem) => `   ${problem}`),
    ].join("\n"),
  };
};
