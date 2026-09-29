import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { type CliEnvironment, defaultEnvironment } from "../../src/cli/environment.js";
import { USAGE } from "../../src/cli/options.js";
import { runCli } from "../../src/cli/run-cli.js";
import { ScriptedProvider, text, toolCall } from "../../src/providers/scripted.js";
import type { CompletionRequest, Provider } from "../../src/providers/types.js";
import { saveRun } from "../../src/report/run-file.js";
import { weatherAgent, writeFiles } from "../support/helpers.js";
import { attempt, run, scenarioResult } from "../support/runs.js";

const SCENARIOS = `
id: lisbon
tags: [smoke]
turns:
  - user: Weather in Lisbon?
expect:
  tools:
    - call: get_forecast
      args: { city: Lisbon }
  answer:
    contains: [sunny]
---
id: porto
turns:
  - user: Weather in Porto?
expect:
  forbidTools: [delete_city]
judge:
  rubric: Gives the forecast.
`;

function model(answer: string): Provider {
  return new ScriptedProvider((request: CompletionRequest) => {
    if (request.forceTool === "record_verdict") {
      return [toolCall("record_verdict", { reasoning: "Fine.", verdict: "pass" })];
    }
    if (request.messages.at(-1)?.role === "tool") return [text(answer)];
    return [toolCall("get_forecast", { city: "Lisbon" })];
  });
}

async function setup(answer = "Sunny, 24°C.") {
  const cwd = await writeFiles({
    "scenarios/weather.yaml": SCENARIOS,
    "prices.json": JSON.stringify({ "test-model": { inputPerMillion: 1, outputPerMillion: 5 } }),
    "bad-prices.json": '{"test-model": {"input": 1}}',
  });
  const logs: string[] = [];
  const env: CliEnvironment = {
    cwd,
    createProvider: () => model(answer),
    importModule: (file) =>
      file.endsWith("agent.js")
        ? Promise.resolve({ default: weatherAgent() })
        : file.endsWith("empty.js")
          ? Promise.resolve({})
          : Promise.reject(new Error("module not found")),
    log: (message) => logs.push(message),
  };
  return { cwd, env, logs };
}

describe("cli basics", () => {
  it("prints usage, version and unknown commands", async () => {
    const { env } = await setup();
    expect(await runCli([], env)).toEqual({ code: 2, output: USAGE });
    expect(await runCli(["--help"], env)).toEqual({ code: 0, output: USAGE });
    expect((await runCli(["--version"], env)).output).toMatch(/^\d+\.\d+\.\d+/);
    expect((await runCli(["fly"], env)).code).toBe(2);
    expect((await runCli(["run", "--nope"], env)).code).toBe(2);
  });

  it("reports input errors with their code", async () => {
    const { env } = await setup();
    expect(await runCli(["run"], env)).toEqual({
      code: 2,
      output: "INVALID_INPUT: Missing the scenarios path. Run agent-evals --help.",
    });
    expect((await runCli(["run", "scenarios", "--agent", "missing.js"], env)).output).toMatch(
      /Cannot import agent missing\.js: module not found/,
    );
    expect((await runCli(["run", "scenarios", "--agent", "empty.js"], env)).output).toMatch(
      /must export an AgentDefinition/,
    );
    expect(
      (await runCli(["run", "scenarios", "--agent", "agent.js", "--repeat", "0"], env)).output,
    ).toMatch(/--repeat must be an integer of at least 1/);
    expect(
      (await runCli(["run", "scenarios", "--agent", "agent.js", "--min-pass-rate", "2"], env))
        .output,
    ).toMatch(/between 0 and 1/);
    expect(
      (
        await runCli(
          [
            "run",
            "scenarios",
            "--agent",
            "agent.js",
            "--judge-model",
            "j",
            "--prices",
            "bad-prices.json",
          ],
          env,
        )
      ).output,
    ).toMatch(/not a valid price table/);
  });
});

describe("run", () => {
  it("runs, prints a summary and writes the JSON and Markdown reports", async () => {
    const { cwd, env, logs } = await setup();
    const result = await runCli(
      [
        "run",
        "scenarios",
        "--agent",
        "agent.js",
        "--judge-model",
        "judge",
        "--repeat",
        "2",
        "--prices",
        "prices.json",
        "--out",
        "runs/latest.json",
        "--markdown",
        "report.md",
      ],
      env,
    );
    expect(result.code).toBe(0);
    expect(result.output).toContain("✅ lisbon 100%");
    expect(result.output).toContain("Saved runs/latest.json\nWrote report.md");
    expect(logs).toHaveLength(4);
    const saved = JSON.parse(await readFile(path.join(cwd, "runs/latest.json"), "utf8")) as {
      summary: { passRate: number };
    };
    expect(saved.summary.passRate).toBe(1);
    expect((saved as unknown as { scenarios: { file: string }[] }).scenarios[0]?.file).toBe(
      path.join("scenarios", "weather.yaml"),
    );
    expect(await readFile(path.join(cwd, "report.md"), "utf8")).toContain("# Agent evaluation");
  });

  it("filters by tag, overrides the model and fails below the minimum pass rate", async () => {
    const { env } = await setup("Rainy.");
    const result = await runCli(
      [
        "run",
        "scenarios",
        "--agent",
        "agent.js",
        "--tag",
        "smoke",
        "--model",
        "other",
        "--min-pass-rate",
        "0.5",
      ],
      env,
    );
    expect(result.code).toBe(1);
    expect(result.output).toContain("weather (other) · 1 scenarios × 1");
    expect(
      (await runCli(["run", "scenarios", "--agent", "agent.js", "--tag", "none"], env)).output,
    ).toMatch(/No scenarios tagged none/);
  });

  it("fails when an attempt errors, even with a lenient minimum", async () => {
    const { env } = await setup();
    const broken: CliEnvironment = { ...env, createProvider: () => ScriptedProvider.sequence([]) };
    const result = await runCli(
      ["run", "scenarios", "--agent", "agent.js", "--tag", "smoke"],
      broken,
    );
    expect(result.code).toBe(1);
    expect(result.output).toContain("PROVIDER_ERROR");
  });
});

describe("compare", () => {
  it("exits with 1 on a regression and can write the Markdown", async () => {
    const { cwd, env } = await setup();
    await saveRun(run([scenarioResult("a", [attempt("pass")])]), path.join(cwd, "base.json"));
    await saveRun(run([scenarioResult("a", [attempt("fail")])]), path.join(cwd, "new.json"));
    const result = await runCli(["compare", "base.json", "new.json", "--markdown", "diff.md"], env);
    expect(result.code).toBe(1);
    expect(result.output).toContain("❌ **Regression**");
    expect(await readFile(path.join(cwd, "diff.md"), "utf8")).toContain("### Regressions");
    expect((await runCli(["compare", "base.json", "base.json"], env)).code).toBe(0);
  });
});

describe("calibrate", () => {
  it("reports whether the judge can be trusted", async () => {
    const { cwd, env } = await setup();
    const cases = await writeFiles({
      "cases.yaml": [
        "id: good",
        "rubric: Gives the forecast.",
        "conversation:",
        "  - user: Weather?",
        "    agent: Sunny.",
        "expected: pass",
        "---",
        "id: bad",
        "rubric: Gives the forecast.",
        "conversation:",
        "  - user: Weather?",
        "    agent: No idea.",
        "expected: fail",
      ].join("\n"),
    });
    const result = await runCli(
      ["calibrate", path.relative(cwd, cases), "--judge-model", "judge"],
      env,
    );
    expect(result.code).toBe(1);
    expect(result.output).toContain(
      "❌ Judge not trusted · judge agreed on 1/2 (50%, minimum 90%) · errors 0",
    );
    expect(result.output).toContain("   bad: expected fail, got pass · Fine.");
    const lenient = await runCli(
      ["calibrate", path.relative(cwd, cases), "--judge-model", "judge", "--min-agreement", "0.5"],
      env,
    );
    expect(lenient.code).toBe(0);
  });
});

describe("validate", () => {
  it("checks scenarios alone or against an agent", async () => {
    const { env } = await setup();
    expect(await runCli(["validate", "scenarios"], env)).toEqual({
      code: 0,
      output: "✅ 2 scenarios valid",
    });
    const result = await runCli(["validate", "scenarios", "--agent", "agent.js"], env);
    expect(result).toEqual({
      code: 1,
      output: '❌ 1 problems\n   porto: the agent has no tool "delete_city"',
    });
  });
});

describe("defaultEnvironment", () => {
  it("requires an API key before calling any model", () => {
    expect(() => defaultEnvironment({}).createProvider()).toThrow(/ANTHROPIC_API_KEY/);
    expect(defaultEnvironment({ ANTHROPIC_API_KEY: "test" }).createProvider().name).toBe(
      "anthropic",
    );
  });
});
