import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadScenarios, parseScenarios } from "../../src/scenarios/load.js";
import { writeFiles } from "../support/helpers.js";

const MINIMAL = "id: greet\nturns:\n  - user: Hi\n";

describe("parseScenarios", () => {
  it("applies defaults to a minimal scenario", () => {
    const [loaded] = parseScenarios(MINIMAL, "a.yaml");
    expect(loaded?.scenario).toEqual({
      id: "greet",
      tags: [],
      turns: [{ user: "Hi" }],
      facts: [],
      expect: {
        tools: [],
        ordered: false,
        forbidTools: [],
        answer: { contains: [], notContains: [] },
        grounded: false,
      },
    });
  });

  it("reads several documents from one file and skips empty ones", () => {
    const text = `${MINIMAL}---\n---\nid: bye\nturns:\n  - user: Bye\n`;
    expect(parseScenarios(text, "a.yaml").map((item) => item.scenario.id)).toEqual([
      "greet",
      "bye",
    ]);
  });

  it("accepts every kind of argument matcher", () => {
    const text = [
      "id: book",
      "turns:",
      "  - user: Book it",
      "expect:",
      "  tools:",
      "    - call: book",
      "      args: { name: Maya, seats: 2, date: { regex: '^2026-' }, note: { any: true }, level: { oneOf: [a, b] } }",
    ].join("\n");
    expect(parseScenarios(text, "a.yaml")[0]?.scenario.expect.tools[0]?.args).toEqual({
      name: "Maya",
      seats: 2,
      date: { regex: "^2026-" },
      note: { any: true },
      level: { oneOf: ["a", "b"] },
    });
  });

  it.each([
    ["an invalid id", "id: Not Valid\nturns:\n  - user: Hi\n", /id: use lowercase/],
    ["no turns", "id: a\nturns: []\n", /turns/],
    ["an unknown key", `${MINIMAL}expect:\n  tool: []\n`, /Unrecognized key/],
    ["broken YAML", "id: [unclosed", /a\.yaml/],
  ])("rejects %s with the file name", (_, text, message) => {
    expect(() => parseScenarios(text, "a.yaml")).toThrow(message);
  });
});

describe("loadScenarios", () => {
  it("loads a folder recursively, in path order", async () => {
    const root = await writeFiles({
      "b.yaml": "id: second\nturns:\n  - user: Hi\n",
      "nested/a.yml": "id: first\nturns:\n  - user: Hi\n",
      "notes.md": "ignored",
    });
    const loaded = await loadScenarios(root);
    expect(loaded.map((item) => [path.relative(root, item.file), item.scenario.id])).toEqual([
      ["b.yaml", "second"],
      [path.join("nested", "a.yml"), "first"],
    ]);
  });

  it("loads a single file", async () => {
    const root = await writeFiles({ "one.yaml": MINIMAL });
    expect(await loadScenarios(path.join(root, "one.yaml"))).toHaveLength(1);
  });

  it("rejects duplicate ids across files", async () => {
    const root = await writeFiles({ "a.yaml": MINIMAL, "b.yaml": MINIMAL });
    await expect(loadScenarios(root)).rejects.toMatchObject({ code: "INVALID_FILE" });
  });

  it("reports a missing path as a file error", async () => {
    const root = await writeFiles({});
    await expect(loadScenarios(path.join(root, "missing"))).rejects.toMatchObject({
      code: "INVALID_FILE",
      message: expect.stringMatching(/^Cannot read .*missing: ENOENT/) as string,
    });
  });

  it("rejects an empty folder", async () => {
    const root = await writeFiles({ "readme.md": "nothing" });
    await expect(loadScenarios(root)).rejects.toThrow(/No YAML documents found/);
  });
});
