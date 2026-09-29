import type { z } from "zod";

/** One line per validation problem: `path.to.field: message`, joined with "; ". */
export function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}
