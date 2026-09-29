import { loadDocuments, parseDocuments } from "../core/yaml-documents.js";
import { type Scenario, scenarioSchema } from "./schema.js";

export interface LoadedScenario {
  file: string;
  scenario: Scenario;
}

export function parseScenarios(text: string, file: string): LoadedScenario[] {
  return parseDocuments(text, file, scenarioSchema).map(({ value }) => ({ file, scenario: value }));
}

/** Loads every scenario from a YAML file or a folder of YAML files; a file may hold several. */
export async function loadScenarios(target: string): Promise<LoadedScenario[]> {
  const documents = await loadDocuments(target, scenarioSchema);
  return documents.map(({ file, value }) => ({ file, scenario: value }));
}
