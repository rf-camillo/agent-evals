import { type AgentTool, defineAgentTool } from "agent-evals";
import { z } from "zod";

import { STUDIO, Studio } from "./studio.js";

export interface ToolOptions {
  /** List the classes with free seats next to the full ones, so the model can offer them. */
  suggestAlternatives: boolean;
}

function availability(studio: Studio, date: string, options: ToolOptions): object {
  const classes = studio.availability(date);
  if (!options.suggestAlternatives || !classes.some((slot) => slot.seats === 0)) {
    return { date, classes };
  }
  const withFreeSeats = classes
    .filter((slot) => slot.seats > 0)
    .map(({ title, start, priceUsd, seats }) => ({ title, start, priceUsd, seats }));
  return { date, classes, withFreeSeats };
}

/** The studio's tools, with a fresh in-memory calendar for every conversation. */
export function createTools(options: ToolOptions): AgentTool[] {
  const studio = new Studio();
  return [
    defineAgentTool({
      name: "get_studio_info",
      description:
        "Address, opening hours, class catalog with prices, cancellation policy and discount policy.",
      input: z.object({}),
      run: () => STUDIO,
    }),
    defineAgentTool({
      name: "check_availability",
      description: "Classes on a date, with start time, duration, price in USD and seats left.",
      input: z.object({ date: z.string().describe("Date in YYYY-MM-DD") }),
      run: ({ date }) => availability(studio, date, options),
    }),
    defineAgentTool({
      name: "book_class",
      description: "Book seats in a class for a customer. Fails if the class is full.",
      input: z.object({
        classId: z.string(),
        name: z.string().describe("Customer's full name"),
        seats: z.number().int().min(1).max(6).default(1),
      }),
      run: ({ classId, name, seats }) => studio.book(classId, name, seats),
    }),
    defineAgentTool({
      name: "cancel_booking",
      description: "Cancel a booking by its id, for example HB-1042.",
      input: z.object({ bookingId: z.string() }),
      run: ({ bookingId }) => studio.cancel(bookingId),
    }),
    defineAgentTool({
      name: "handoff_to_staff",
      description: "Pass the conversation to a person at the studio.",
      input: z.object({ reason: z.string() }),
      run: ({ reason }) => ({
        ticket: "T-77",
        reason,
        reply: "A team member will reply within one business day.",
      }),
    }),
  ];
}
