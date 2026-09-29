import { describe, expect, it } from "vitest";

import { PACKAGE_NAME, PACKAGE_VERSION } from "../../src/core/version.js";

describe("version", () => {
  it("reads the package name and a semantic version", () => {
    expect(PACKAGE_NAME).toBe("agent-evals");
    expect(PACKAGE_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
