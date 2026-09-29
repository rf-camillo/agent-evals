import path from "node:path";

import { describe, expect, it } from "vitest";

import { compareRuns } from "../../src/report/compare.js";
import { renderComparison } from "../../src/report/compare-markdown.js";
import { duration, percent, signedPercentPoints, tokens, usd } from "../../src/report/format.js";
import { renderMarkdown } from "../../src/report/markdown.js";
import { markdownTable } from "../../src/report/markdown-table.js";
import { loadRun, saveRun } from "../../src/report/run-file.js";
import { renderTerminal } from "../../src/report/terminal.js";
import { tempDir, writeFiles } from "../support/helpers.js";
import { attempt, run, scenarioResult } from "../support/runs.js";
import { transcript } from "../support/transcripts.js";

const mixed = run([
  scenarioResult("book-class", [attempt("pass"), attempt("pass")]),
  scenarioResult("price-question", [attempt("pass"), attempt("fail")]),
  scenarioResult("complaint", [
    attempt("fail", { judge: { verdict: "fail", reasoning: "Did not apologize." }, checks: [] }),
    attempt("error"),
  ]),
]);

describe("format", () => {
  it("formats numbers for people", () => {
    expect(percent(0.8333)).toBe("83.3%");
    expect(signedPercentPoints(0.05)).toBe("+5 pp");
    expect(signedPercentPoints(-0.125)).toBe("-12.5 pp");
    expect(usd(0.0021)).toBe("$0.0021");
    expect(usd(1.5)).toBe("$1.50");
    expect(usd(null)).toBe("unknown");
    expect(duration(850)).toBe("850 ms");
    expect(duration(1540)).toBe("1.5 s");
    expect(tokens(950)).toBe("950");
    expect(tokens(12_345)).toBe("12.3k");
  });
});

describe("markdownTable", () => {
  it("keeps a trailing backslash from escaping the cell separator", () => {
    expect(markdownTable(["Path"], [["C:\\runs\\"]])).toBe("| Path |\n| --- |\n| C:\\\\runs\\\\ |");
  });

  it("builds a table and escapes pipes and line breaks", () => {
    expect(markdownTable(["", "Name"], [["✅", "a | b\r\nc"]])).toBe(
      "|  | Name |\n| --- | --- |\n| ✅ | a \\| b c |",
    );
  });
});

describe("renderMarkdown", () => {
  it("summarizes, lists scenarios and explains every attempt that did not pass", () => {
    const markdown = renderMarkdown(mixed);
    expect(markdown).toContain(
      "**Agent** `harbor` on `claude-haiku-4-5` · **Judge** `claude-sonnet-5` · **Repeat** 2",
    );
    expect(markdown).toContain(
      "| **50%** | 1 pass · 1 flaky · 0 fail · 1 error | 3 / 6 | 1 | $0.01 |",
    );
    expect(markdown).toContain("| ✅ | `book-class` | 100% | 1.5 s |");
    expect(markdown).toContain("| ⚠️ | `price-question` | 50% | 1.5 s |");
    expect(markdown).toContain(
      '### ❌ `price-question` · attempt 2\n\n- answer: final answer does not mention "confirmed"',
    );
    expect(markdown).toContain("### ❌ `complaint` · attempt 1\n\n- judge: Did not apologize.");
    expect(markdown).toContain(
      "### 💥 `complaint` · attempt 2\n\n- TIMEOUT: Timed out after 10 ms",
    );
  });

  it("leaves out the problems section when everything passed", () => {
    const allGood = run([scenarioResult("book-class", [attempt("pass")])]);
    expect(renderMarkdown(allGood)).not.toContain("What went wrong");
    expect(renderMarkdown(allGood)).not.toContain("## Guards");
    expect(renderMarkdown({ ...allGood, judge: null })).toContain("**Judge** none");
  });

  it("lists the answers a guard held back", () => {
    const guarded = transcript({ answer: "Booked!", calls: [{ name: "book_class" }] });
    guarded.turns[0]?.rejections.push({
      answer: "I've booked\nyour class.",
      feedback: "book_class did not succeed.",
    });
    const markdown = renderMarkdown(
      run([scenarioResult("booking", [attempt("pass", { transcript: guarded })])]),
    );
    guarded.turns[0]?.rejections.push({ answer: "Done!", feedback: "Not booked." });
    const guardedRun = run([scenarioResult("booking", [attempt("pass", { transcript: guarded })])]);
    expect(renderTerminal(guardedRun).split("\n")).toContain(
      "   🛡️ booking #1 guard held back 2 answers",
    );
    expect(markdown).toContain(
      "## Guards\n\nAnswers a guard stopped before they reached the customer.\n\n### 🛡️ `booking` · attempt 1\n\n- Held back: “I've booked your class.”\n  Feedback: “book_class did not succeed.”",
    );
  });
});

describe("renderTerminal", () => {
  it("prints one line per scenario, the problems and a summary", () => {
    const lines = renderTerminal(mixed).split("\n");
    expect(lines[0]).toBe("harbor (claude-haiku-4-5) · 3 scenarios × 2");
    expect(lines).toContain("⚠️ price-question 50%");
    expect(lines).toContain("   complaint #2 TIMEOUT: Timed out after 10 ms");
    expect(lines.at(-1)).toBe(
      "Pass rate 50% (3/6) · errors 1 · cost $0.01 · p50 1.5 s · p95 1.5 s",
    );
  });
});

describe("compareRuns", () => {
  const baseline = run([
    scenarioResult("a", [attempt("pass"), attempt("pass")]),
    scenarioResult("b", [attempt("fail"), attempt("fail")]),
    scenarioResult("old", [attempt("pass"), attempt("pass")]),
  ]);

  it("finds regressions, improvements, added and removed scenarios", () => {
    const candidate = run([
      scenarioResult("a", [attempt("pass"), attempt("fail")]),
      scenarioResult("b", [attempt("pass"), attempt("pass")]),
      scenarioResult("new", [attempt("pass"), attempt("pass")]),
    ]);
    const comparison = compareRuns(baseline, candidate);
    expect(comparison).toMatchObject({
      regressions: [{ id: "a", before: 1, after: 0.5 }],
      improvements: [{ id: "b", before: 0, after: 1 }],
      added: ["new"],
      removed: ["old"],
      failed: true,
    });
    expect(comparison.passRate.delta).toBe(0.1666);
  });

  it("passes when nothing regressed, and fails on a pass-rate drop beyond the limit or on errors", () => {
    const same = compareRuns(baseline, baseline);
    expect(same.failed).toBe(false);

    const lower = run([
      scenarioResult("a", [attempt("pass"), attempt("pass")]),
      scenarioResult("b", [attempt("fail"), attempt("fail")]),
    ]);
    const withoutOld = compareRuns(baseline, lower, 0.5);
    expect(withoutOld.passRate.delta).toBe(-0.1667);
    expect(withoutOld.failed).toBe(false);
    expect(compareRuns(baseline, lower, 0.1).failed).toBe(true);

    const erroring = run([scenarioResult("a", [attempt("pass"), attempt("error")])]);
    expect(compareRuns(erroring, erroring).failed).toBe(true);
  });

  it("renders a comparison for a pull request", () => {
    const candidate = run([scenarioResult("a", [attempt("fail"), attempt("fail")])]);
    const markdown = renderComparison(compareRuns(baseline, candidate));
    expect(markdown).toContain("❌ **Regression** · pass rate 66.7% → 0% (-66.7 pp) · errors 0");
    expect(markdown).toContain("### Regressions\n\n- `a` 100% → 0%");
    expect(markdown).toContain("### Removed scenarios\n\n- `b`\n- `old`");
    expect(renderComparison(compareRuns(baseline, baseline))).toContain("✅ **No regression**");
  });
});

describe("run files", () => {
  it("save and load a run", async () => {
    const file = path.join(await tempDir(), "runs", "baseline.json");
    await saveRun(mixed, file);
    expect(await loadRun(file)).toEqual(mixed);
  });

  it("refuse other files", async () => {
    const root = await writeFiles({ "other.json": '{"version": 2}', "broken.json": "{" });
    await expect(loadRun(path.join(root, "other.json"))).rejects.toThrow(/not an agent-evals run/);
    await expect(loadRun(path.join(root, "broken.json"))).rejects.toMatchObject({
      code: "INVALID_FILE",
    });
  });
});
