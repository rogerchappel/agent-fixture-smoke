import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

test("reports forbidden effects as blocked without executing in report mode", async () => {
  const directory = await mkdtemp(join(tmpdir(), "agent-fixture-smoke-"));
  const marker = join(directory, "executed");
  const plan = [{
    id: "blocked-report",
    command: [process.execPath, "-e", `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "")`],
    mode: "executable",
    checks: [{ type: "forbidden-effect", value: "remote-message" }]
  }];

  try {
    const report = await runPlan(plan, { execute: false });
    assert.deepEqual(report.summary, { passed: 0, failed: 0, blocked: 1, skipped: 0 });
    assert.equal(report.results[0].status, "blocked");
    await assert.rejects(access(marker));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("returns a nonzero blocked result from report", () => {
  const result = spawnSync("node", [
    "bin/agent-fixture-smoke.js",
    "report",
    "fixtures/blocked.json",
    "--format",
    "markdown"
  ], { encoding: "utf8" });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Passed: 0/);
  assert.match(result.stdout, /Blocked: 1/);
  assert.match(result.stdout, /Status: blocked/);
});

test("prints package version for CLI smoke checks", () => {
  const result = spawnSync("node", ["bin/agent-fixture-smoke.js", "--version"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), packageJson.version);
});
