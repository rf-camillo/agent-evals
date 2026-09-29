import { errorMessage, EvalError } from "../core/errors.js";
import { PACKAGE_VERSION } from "../core/version.js";
import { calibrateCommand } from "./calibrate-command.js";
import type { Command, CommandResult } from "./command.js";
import { compareCommand } from "./compare-command.js";
import { type CliEnvironment, defaultEnvironment } from "./environment.js";
import { parseCli, type ParsedCli, USAGE } from "./options.js";
import { runCommand } from "./run-command.js";
import { validateCommand } from "./validate-command.js";

const COMMANDS: Readonly<Record<string, Command>> = {
  run: runCommand,
  compare: compareCommand,
  calibrate: calibrateCommand,
  validate: validateCommand,
};

/** Runs the CLI and returns the exit code and output instead of touching the process. */
export async function runCli(
  argv: readonly string[],
  env: CliEnvironment = defaultEnvironment(),
): Promise<CommandResult> {
  let parsed: ParsedCli;
  try {
    parsed = parseCli(argv);
  } catch (error) {
    return { code: 2, output: `${errorMessage(error)}\n\n${USAGE}` };
  }
  const { values, command, positionals } = parsed;
  if (values.version === true) return { code: 0, output: PACKAGE_VERSION };
  if (values.help === true) return { code: 0, output: USAGE };
  if (command === undefined) return { code: 2, output: USAGE };

  const handler = COMMANDS[command];
  if (handler === undefined) return { code: 2, output: `Unknown command "${command}"\n\n${USAGE}` };
  try {
    return await handler(positionals, values, env);
  } catch (error) {
    const code = error instanceof EvalError ? error.code : "UNEXPECTED";
    return { code: 2, output: `${code}: ${errorMessage(error)}` };
  }
}
