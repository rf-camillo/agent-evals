import { readFileSync } from "node:fs";

interface PackageJson {
  name: string;
  version: string;
}

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as PackageJson;

export const PACKAGE_NAME = packageJson.name;
export const PACKAGE_VERSION = packageJson.version;
