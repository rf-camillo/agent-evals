import path from "node:path";
import { pathToFileURL } from "node:url";

import { EvalError } from "../core/errors.js";
import { AnthropicProvider } from "../providers/anthropic.js";
import type { Provider } from "../providers/types.js";

/** What the CLI needs from the outside world, replaceable in tests. */
export interface CliEnvironment {
  cwd: string;
  createProvider(): Provider;
  importModule(file: string): Promise<unknown>;
  log(message: string): void;
}

export function defaultEnvironment(env: NodeJS.ProcessEnv = process.env): CliEnvironment {
  return {
    cwd: process.cwd(),
    createProvider: () => {
      if (env.ANTHROPIC_API_KEY === undefined || env.ANTHROPIC_API_KEY === "") {
        throw new EvalError("INVALID_INPUT", "Set ANTHROPIC_API_KEY to call the models");
      }
      return new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY });
    },
    importModule: (file) => import(pathToFileURL(path.resolve(file)).href) as Promise<unknown>,
    log: (message) => process.stderr.write(`${message}\n`),
  };
}
