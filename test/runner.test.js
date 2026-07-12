import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { loadFixtures } from "../src/fixtures.js";
import { createPlan } from "../src/planner.js";
import { runPlan } from "../src/runner.js";
import packageJson from "../package.json" with { type: "json" };

test("creates dry-run smoke plans from fixtures", async () => {
  const fixtures = await loadFixtures(["fixtures/pass.json"]);
  const plan = createPlan(fixtures);
  assert.equal(plan[0].mode, "executable");
  assert.equal(plan[0].checks[0].type, "stdout-contains");
});

test("blocks fixtures with forbidden effects", async () => {
  const fixtures = await loadFixtures(["fixtures/blocked.json"]);
  const report = await runPlan(createPlan(fixtures), { execute: true });
  assert.equal(report.summary.blocked, 1);
});

test("prints package version for CLI smoke checks", () => {
  const result = spawnSync("node", ["bin/agent-fixture-smoke.js", "--version"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), packageJson.version);
});
