function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function row(cells: readonly string[]): string {
  return `| ${cells.map(escapeCell).join(" | ")} |`;
}

/** A GitHub-flavored Markdown table; pipes and line breaks in cells are escaped. */
export function markdownTable(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  return [row(headers), row(headers.map(() => "---")), ...rows.map(row)].join("\n");
}
