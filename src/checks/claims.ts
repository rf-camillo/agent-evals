export type ClaimKind = "money" | "time" | "date";

/** A checkable detail quoted in text, with a normalized value for comparison. */
export interface Claim {
  kind: ClaimKind;
  text: string;
  value: string;
}

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

const MONEY = /(?:[$€£]|R\$|US\$)\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/gi;
const CLOCK = /\b([01]?\d|2[0-3])(?::([0-5]\d))\s*(am|pm)?\b|\b(1[0-2]|0?[1-9])\s*(am|pm)\b/gi;
const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const MONTH_NAME =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function money(amount: string): string {
  const cents = /[.,](\d{1,2})$/.exec(amount);
  const onlyThousands = /^\d{1,3}(?:[.,]\d{3})+$/.test(amount);
  if (cents === null || onlyThousands) return Number(amount.replace(/[.,]/g, "")).toFixed(2);
  const units = amount.slice(0, cents.index).replace(/[.,]/g, "");
  return Number(`${units}.${cents[1] ?? ""}`).toFixed(2);
}

function clock(hours: number, minutes: number, meridiem: string | undefined): string {
  const suffix = meridiem?.toLowerCase();
  const hour24 =
    suffix === "pm" && hours < 12 ? hours + 12 : suffix === "am" && hours === 12 ? 0 : hours;
  return `${pad(hour24)}:${pad(minutes)}`;
}

function monthIndex(name: string): number {
  return MONTHS.findIndex((month) => name.toLowerCase().startsWith(month)) + 1;
}

/** Finds prices, clock times and dates, normalized so "$45" matches "45.00" and "9am" matches "09:00". */
export function extractClaims(text: string): Claim[] {
  const claims: Claim[] = [];
  for (const match of text.matchAll(MONEY)) {
    claims.push({ kind: "money", text: match[0], value: money(match[1] ?? "") });
  }
  for (const match of text.matchAll(CLOCK)) {
    const hours = Number(match[1] ?? match[4]);
    const minutes = Number(match[2] ?? 0);
    claims.push({
      kind: "time",
      text: match[0].trim(),
      value: clock(hours, minutes, match[3] ?? match[5]),
    });
  }
  for (const match of text.matchAll(ISO_DATE)) {
    claims.push({ kind: "date", text: match[0], value: `${match[2] ?? ""}-${match[3] ?? ""}` });
  }
  for (const match of text.matchAll(MONTH_NAME)) {
    const day = Number(match[2]);
    claims.push({
      kind: "date",
      text: match[0],
      value: `${pad(monthIndex(match[1] ?? ""))}-${pad(day)}`,
    });
  }
  return claims;
}

/** Plain numbers in evidence also count for prices, so a tool returning `"price": 45` grounds "$45". */
export function evidenceValues(text: string): Set<string> {
  const values = new Set(extractClaims(text).map((claim) => `${claim.kind}:${claim.value}`));
  for (const match of text.matchAll(/(?<![\d.])(\d+(?:\.\d{1,2})?)(?![\d.])/g)) {
    values.add(`money:${Number(match[1]).toFixed(2)}`);
  }
  return values;
}
