import { isDeepStrictEqual } from "node:util";

import type { ArgMatcher } from "../scenarios/schema.js";

function describe(value: unknown): string {
  return value === undefined ? "missing" : JSON.stringify(value);
}

function matches(matcher: ArgMatcher, value: unknown): boolean {
  if (matcher === null || typeof matcher !== "object") return isDeepStrictEqual(matcher, value);
  if ("any" in matcher) return value !== undefined;
  if ("oneOf" in matcher) return matcher.oneOf.some((option) => isDeepStrictEqual(option, value));
  const isScalar =
    typeof value === "string" || typeof value === "number" || typeof value === "boolean";
  return isScalar && new RegExp(matcher.regex).test(String(value));
}

function describeMatcher(matcher: ArgMatcher): string {
  if (matcher === null || typeof matcher !== "object") return JSON.stringify(matcher);
  if ("any" in matcher) return "any value";
  if ("oneOf" in matcher) return `one of ${JSON.stringify(matcher.oneOf)}`;
  return `/${matcher.regex}/`;
}

/** Lists every expected argument that the actual input does not satisfy. */
export function argMismatches(
  expected: Readonly<Record<string, ArgMatcher>>,
  actual: Readonly<Record<string, unknown>>,
): string[] {
  return Object.entries(expected).flatMap(([key, matcher]) =>
    matches(matcher, actual[key])
      ? []
      : [`${key}: expected ${describeMatcher(matcher)}, got ${describe(actual[key])}`],
  );
}
