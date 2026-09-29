import type { CliEnvironment } from "./environment.js";
import type { CliValues } from "./options.js";

export interface CommandResult {
  code: number;
  output: string;
}

export type Command = (
  positionals: readonly string[],
  values: CliValues,
  env: CliEnvironment,
) => Promise<CommandResult>;
