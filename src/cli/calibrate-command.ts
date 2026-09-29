import path from "node:path";

import { calibrate, type CalibrationReport, DEFAULT_MIN_AGREEMENT } from "../judge/calibrate.js";
import { loadCalibrationCases } from "../judge/calibration-case.js";
import { percent } from "../report/format.js";
import type { Command } from "./command.js";
import { ratioFlag, requireArg } from "./flags.js";

function renderCalibration(report: CalibrationReport, model: string): string {
  const verdict = report.trusted ? "✅ Judge trusted" : "❌ Judge not trusted";
  return [
    `${verdict} · ${model} agreed on ${String(report.agreed)}/${String(report.total)} (${percent(report.agreement)}, minimum ${percent(report.minAgreement)}) · errors ${String(report.errors)}`,
    ...report.disagreements.map(
      (item) =>
        `   ${item.id}: expected ${item.expected}, got ${item.actual ?? "error"} · ${item.reasoning}`,
    ),
  ].join("\n");
}

export const calibrateCommand: Command = async ([target], values, env) => {
  const cases = await loadCalibrationCases(
    path.resolve(env.cwd, requireArg(target, "the calibration cases path")),
  );
  const model = requireArg(values["judge-model"], "--judge-model");
  const minAgreement = ratioFlag(values["min-agreement"], "min-agreement") ?? DEFAULT_MIN_AGREEMENT;
  const report = await calibrate({ provider: env.createProvider(), model }, cases, minAgreement);
  return { code: report.trusted ? 0 : 1, output: renderCalibration(report, model) };
};
