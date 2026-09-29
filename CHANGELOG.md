# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - Unreleased

### Added

- Scenarios in YAML with argument matchers, ordered and forbidden tools, answer phrases, groundedness, handoff and judge rubrics.
- A conversation loop for tool-using agents with zod tool schemas, fresh tools per conversation and a step limit.
- Answer guards: functions that hold back a final answer and send the model feedback, with every held-back answer kept in the transcript and listed in the reports.
- Deterministic checks: tools, forbidden tools, answer, groundedness of prices, times and dates, and handoff.
- An LLM judge with forced structured verdicts, and calibration against conversations with known verdicts.
- A runner with repetitions, bounded concurrency, timeouts, three-state attempts, cost and latency.
- JSON, Markdown and terminal reports, and run comparison that fails on any regression.
- A CLI with `run`, `compare`, `calibrate` and `validate`, and the Anthropic and scripted providers.
- The Harbor example with a baseline and a guarded agent, 15 scenarios, calibration cases, real results and a case study.
