export const JUDGE_DEFAULTS = {
  /** Output budget for one verdict, reasoning included. */
  maxTokens: 1024,
  /** Tool output longer than this is truncated in the judge's view of the conversation. */
  maxToolOutputChars: 2000,
  /** Calibration cases graded at the same time. */
  concurrency: 4,
} as const;
