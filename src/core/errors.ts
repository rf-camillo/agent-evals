export type EvalErrorCode =
  "INVALID_FILE" | "INVALID_INPUT" | "PROVIDER_ERROR" | "JUDGE_ERROR" | "MAX_STEPS" | "TIMEOUT";

/** An expected failure with a stable {@link EvalErrorCode}. */
export class EvalError extends Error {
  readonly code: EvalErrorCode;

  constructor(code: EvalErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "EvalError";
    this.code = code;
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
