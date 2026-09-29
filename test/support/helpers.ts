import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach } from "vitest";
import { z } from "zod";

import { type AgentDefinition, defineAgentTool } from "../../src/agent/definition.js";

const created: string[] = [];

afterEach(async () => {
  await Promise.all(created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

export async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "agent-evals-"));
  created.push(dir);
  return dir;
}

export async function writeFiles(files: Record<string, string>): Promise<string> {
  const root = await tempDir();
  for (const [file, content] of Object.entries(files)) {
    const absolute = path.join(root, ...file.split("/"));
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, content);
  }
  return root;
}

export function weatherAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    name: "weather",
    model: "test-model",
    system: "You answer weather questions.",
    createTools: () => [
      defineAgentTool({
        name: "get_forecast",
        description: "Forecast for a city",
        input: z.object({ city: z.string() }),
        run: ({ city }) => {
          if (city === "Atlantis") throw new Error("City not found");
          return { city, forecast: "sunny", high: 24 };
        },
      }),
    ],
    ...overrides,
  };
}
