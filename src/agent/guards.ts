import type { AnswerGuard, GuardInput } from "./definition.js";

/** Returns the feedback of the first guard that rejects the answer, or `null` if all accept it. */
export function firstRejection(guards: readonly AnswerGuard[], input: GuardInput): string | null {
  for (const guard of guards) {
    const feedback = guard(input);
    if (feedback !== null) return feedback;
  }
  return null;
}

/**
 * How a rejection reaches the model. It arrives as a user message, so it must say it is not
 * the customer: otherwise the model answers it ("You're right, …") in front of the customer.
 */
export function guardMessage(feedback: string): string {
  return `[Automatic check. This is not the customer, who never saw your last answer.] ${feedback} Then answer the customer's last message directly, without mentioning this check.`;
}
