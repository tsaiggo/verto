import fs from "fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";

async function readProjectFile(file: string): Promise<string> {
  return fs.readFile(path.join(process.cwd(), file), "utf-8");
}

describe("nightly assistant build", () => {
  it("enables GitHub Models without exposing a credential through public build variables", async () => {
    const workflow = await readProjectFile(".github/workflows/nightly.yml");
    const stepName = "- name: Build & publish to rolling `nightly` release";
    const stepStart = workflow.indexOf(stepName);
    const stepEnd = workflow.indexOf("\n        with:", stepStart);

    expect(stepStart).toBeGreaterThanOrEqual(0);
    expect(stepEnd).toBeGreaterThan(stepStart);

    const publishStep = workflow.slice(stepStart, stepEnd);
    expect(publishStep).toMatch(/^\s*NEXT_PUBLIC_VERTO_ASSISTANT:\s*github\s*$/m);

    const publicEnvLines = workflow.match(/^\s+NEXT_PUBLIC_[A-Z0-9_]+:.*$/gm) ?? [];
    for (const line of publicEnvLines) {
      const variableName = line.trimStart().split(":", 1)[0];
      expect(variableName).not.toMatch(/(?:TOKEN|SECRET|PASSWORD|API_KEY)/);
      expect(line).not.toMatch(/\${{\s*secrets\./);
    }
  });
});
