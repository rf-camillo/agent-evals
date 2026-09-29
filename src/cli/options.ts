import { parseArgs } from "node:util";

export const USAGE = `Usage: agent-evals <command> [options]

Commands:
  run <scenarios> --agent <module>     Run scenarios against an agent
      [--model M] [--judge-model M] [--repeat N] [--concurrency N] [--timeout MS]
      [--tag T]... [--prices FILE] [--out FILE] [--markdown FILE] [--min-pass-rate R]
  compare <baseline.json> <candidate.json> [--max-drop R] [--markdown FILE]
  calibrate <cases> --judge-model M [--min-agreement R]
  validate <scenarios> [--agent <module>]

The agent module's default export is an AgentDefinition. Models are called through the
Anthropic API with ANTHROPIC_API_KEY.

Exit codes: 0 passed, 1 the evaluation did not pass, 2 invalid usage or input.`;

const OPTIONS = {
  agent: { type: "string" },
  model: { type: "string" },
  "judge-model": { type: "string" },
  repeat: { type: "string" },
  concurrency: { type: "string" },
  timeout: { type: "string" },
  tag: { type: "string", multiple: true },
  prices: { type: "string" },
  out: { type: "string" },
  markdown: { type: "string" },
  "min-pass-rate": { type: "string" },
  "max-drop": { type: "string" },
  "min-agreement": { type: "string" },
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
} as const;

export type CliValues = ReturnType<
  typeof parseArgs<{ options: typeof OPTIONS; allowPositionals: true }>
>["values"];

export interface ParsedCli {
  values: CliValues;
  command: string | undefined;
  positionals: string[];
}

export function parseCli(argv: readonly string[]): ParsedCli {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: OPTIONS,
    allowPositionals: true,
  });
  const [command, ...rest] = positionals;
  return { values, command, positionals: rest };
}
