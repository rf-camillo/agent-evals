import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { parseAllDocuments } from "yaml";
import type { z } from "zod";

import { errorMessage, EvalError } from "./errors.js";
import { formatIssues } from "./zod-issues.js";

const YAML_FILE = /\.ya?ml$/i;

export interface Document<T> {
  file: string;
  value: T;
}

/** Parses every YAML document in `text`, skipping empty ones, and validates each with `schema`. */
export function parseDocuments<Schema extends z.ZodType>(
  text: string,
  file: string,
  schema: Schema,
): Document<z.output<Schema>>[] {
  return parseAllDocuments(text).flatMap((document, index) => {
    const [firstError] = document.errors;
    if (firstError) throw new EvalError("INVALID_FILE", `${file}: ${errorMessage(firstError)}`);
    const data: unknown = document.toJS();
    if (data === null || data === undefined) return [];
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new EvalError(
        "INVALID_FILE",
        `${file} (document ${String(index + 1)}): ${formatIssues(result.error)}`,
      );
    }
    return [{ file, value: result.data }];
  });
}

async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isDirectory();
  } catch (error) {
    throw new EvalError("INVALID_FILE", `Cannot read ${target}: ${errorMessage(error)}`);
  }
}

async function yamlFiles(target: string): Promise<string[]> {
  if (!(await isDirectory(target))) return [target];
  const entries = await readdir(target, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && YAML_FILE.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Loads documents from a YAML file or a folder of YAML files, in path order.
 * Fails when nothing is found or when two documents share an id.
 */
export async function loadDocuments<Schema extends z.ZodType<{ id: string }>>(
  target: string,
  schema: Schema,
): Promise<Document<z.output<Schema>>[]> {
  const files = await yamlFiles(target);
  const parsed = await Promise.all(
    files.map(async (file) => parseDocuments(await readFile(file, "utf8"), file, schema)),
  );
  const documents = parsed.flat();
  if (documents.length === 0) {
    throw new EvalError("INVALID_FILE", `No YAML documents found in ${target}`);
  }

  const seen = new Map<string, string>();
  for (const { file, value } of documents) {
    const first = seen.get(value.id);
    if (first !== undefined) {
      throw new EvalError("INVALID_FILE", `Duplicate id "${value.id}" in ${first} and ${file}`);
    }
    seen.set(value.id, file);
  }
  return documents;
}
