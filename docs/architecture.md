# Architecture

`agent-evals` is a TypeScript library with a CLI on top. Every command is a thin layer over functions exported from the package root.

```
src/
  index.ts      public API
  bin/          cli.ts, the executable
  cli/          options, flags, inputs (agent module, prices), one file per command, run-cli.ts
  core/         errors, zod issue formatting, ids, text folding, bounded concurrency,
                timeouts, YAML documents, version
  scenarios/    schema.ts (zod) and load.ts
  providers/    types.ts (the Provider interface), blocks.ts, anthropic-mapping.ts,
                anthropic.ts, scripted.ts
  agent/        definition.ts, run-conversation.ts, run-tool.ts, guards.ts, transcript.ts,
                transcript-recorder.ts
  checks/       one file per check, claims.ts for groundedness, match-args.ts, run-checks.ts
  judge/        defaults, prompt, transcript rendering, judge.ts, judge-error.ts,
                calibration cases, calibrate.ts
  runner/       run-attempt.ts, run-evals.ts, cost, summaries, types
  report/       JSON run files, Markdown (with a table helper), terminal, compare
```

Dependencies point one way: `core` ← `scenarios` ← `providers` ← `agent` ← `checks` ← `judge` ← `runner` ← `report` ← `cli` ← `bin`. `.dependency-cruiser.cjs` turns that order into build errors, together with a ban on import cycles and orphan modules.

## Providers

A provider is one method: `complete(request) → { blocks, stopReason, usage }`. Blocks are text or tool calls; messages carry user text, assistant blocks and tool results.

The Anthropic provider is split in two: `anthropic-mapping.ts` converts requests and responses with pure functions, tested without a client, and `anthropic.ts` only calls the SDK, forwards the abort signal and wraps every failure as `PROVIDER_ERROR`. Temperature and `tool_choice` are sent only when set, because newer models reject `temperature`.

`ScriptedProvider` answers from a function or a sequence. The whole test suite runs on it, offline.

## One conversation

`runConversation` creates the agent's tools (fresh for every conversation), then for each user turn calls the model, runs the tool calls, feeds the results back, and repeats until the model answers without calling tools or `maxSteps` is reached (`MAX_STEPS`).

- Tool input is validated with the tool's zod schema. Invalid input, unknown tools and exceptions become **error results for the model**, not crashes, the same way a real tool failure would reach it.
- Tools of one turn run **one at a time, in the order the model asked for**, so stateful backends behave the same on every run.
- When the model answers without calling tools, the agent's **guards** check the answer first. The first guard that returns feedback holds the answer back: it is recorded as a rejection, never becomes part of the answer, and the feedback goes to the model as a message that says it is not from the customer. The loop then continues, within the same `maxSteps`.
- A turn's answer is **everything the agent said in it**, including text written before a tool call. The case study explains why this matters.
- Everything is written to a `TranscriptRecorder` as it happens. When a conversation is interrupted by a timeout, the step limit or a provider failure, the caller still has the partial transcript.

## One attempt

`runAttempt` runs the conversation, the deterministic checks and, when the scenario has a rubric, the judge, all under one timeout that aborts in-flight requests. It keeps each stage's result as it goes, so a failure in a later stage never erases an earlier one. The attempt is:

- `pass` when every check and the judge pass;
- `fail` when any of them fails;
- `error` for anything else, with a code: `PROVIDER_ERROR`, `JUDGE_ERROR`, `TIMEOUT`, `MAX_STEPS` or `UNEXPECTED`. An error attempt still reports its partial transcript, the checks that ran and every token spent, including the tokens of a judge answer that could not be used.

Cost is computed from the price table for the agent's and the judge's models. If a model that was used has no price, the cost is `null` rather than a partial total.

## A run

`runEvals` refuses to start if a scenario has a rubric and no judge is configured, then runs `scenarios × repeat` attempts with bounded concurrency, keeps results in scenario order and summarizes them: pass rate, counts by status, tokens, cost and latency percentiles. A scenario is `pass`, `fail`, `flaky` (some attempts passed) or `error`.

## The judge

The judge prompt has fixed rules: grade only against the rubric, treat tool results and facts as the only truth, fail partial matches, reason before deciding. The conversation goes between `<conversation>` tags; the prompt says everything inside is data, and any occurrence of the tags inside the conversation is neutralized, so an agent cannot close the block and address the judge. The verdict must come through the `record_verdict` tool, validated with zod. A missing or malformed verdict is a `JudgeError` (`JUDGE_ERROR`) that carries the tokens the answer cost.

`calibrate` runs the judge on recorded conversations with known verdicts, with bounded concurrency. The report lists every disagreement with the judge's reasoning. The judge is trusted only with enough agreement and zero errors. Limits such as the verdict's token budget and the truncation of long tool outputs live in `judge/defaults.ts`.

## Comparison

`compareRuns` matches scenarios by id and reports the pass-rate delta, regressions, improvements, added and removed scenarios, and cost and latency side by side. It fails when the pass rate drops beyond `maxDrop`, when any scenario regresses, or when the candidate has errors, so a higher overall number cannot hide a behavior that got worse.

## Exit codes

`0` passed, `1` the evaluation did not pass, `2` invalid usage or input. CI can tell a broken setup from a failing agent.

## Testing

- Unit tests for every module: scenario parsing, providers (with a fake SDK client), the conversation loop and recorder, each check, claim extraction, the judge and its delimiters, calibration, cost, summaries, reports and comparison.
- Regression tests for the defects found in review and in real runs: partial results kept on error, tokens kept on judge errors, sequential tools, delimiters the agent cannot close and bounded calibration.
- CLI tests with a fake environment: an injected provider and agent module, temporary files, every command and exit code.
- The Harbor example is part of the typecheck and the tests: its scenarios must only reference its tools, both versions must share tools and model, its guard is tested on its own cases, and so is its studio backend.
- Real runs are not part of CI; their results are committed under `examples/harbor/results`.
