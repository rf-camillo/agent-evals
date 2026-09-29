import type { AnswerGuard } from "agent-evals";

const BOOKING_ID = /\bHB-\d+\b/g;
const CLAIMS_BOOKING =
  /\b(?:I've booked|I have booked|you're booked|you are booked|booking (?:is )?confirmed)\b/i;

function bookedIds(outputs: readonly string[]): Set<string> {
  return new Set(outputs.flatMap((output) => output.match(BOOKING_ID) ?? []));
}

/**
 * A booking may be confirmed only if `book_class` succeeded in this turn, and every booking
 * id in the answer must come from a tool result or from the customer.
 */
export const noUnbookedConfirmation: AnswerGuard = ({ user, answer, toolCalls }) => {
  const succeeded = toolCalls.filter((call) => !call.isError);
  const booked = succeeded.some((call) => call.name === "book_class");
  if (CLAIMS_BOOKING.test(answer) && !booked) {
    return "You told the customer the class is booked, but book_class did not succeed in this turn. Call book_class now, or tell the customer the booking is not done yet.";
  }
  const known = bookedIds([...succeeded.map((call) => call.output), user]);
  const invented = (answer.match(BOOKING_ID) ?? []).filter((id) => !known.has(id));
  if (invented.length > 0) {
    return `The booking id ${invented.join(", ")} did not come from any tool result. Only quote ids that book_class or cancel_booking returned.`;
  }
  return null;
};
