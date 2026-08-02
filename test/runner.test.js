import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadFixtures } from "../src/fixtures.js";
import { createPlan } from "../src/planner.js";
import { runPlan } from "../src/runner.js";
import { renderJson, renderMarkdown } from "../src/reporter.js";
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

test("records a nonzero command and continues to later fixtures", async () => {
  const plan = [
    {
      id: "fails",
      command: [process.execPath, "-e", "console.log('before exit'); console.error('boom'); process.exit(7)"],
      mode: "executable",
      checks: []
    },
    {
      id: "continues",
      command: [process.execPath, "-e", "console.log('after')"],
      mode: "executable",
      checks: [{ type: "stdout-contains", value: "after" }]
    }
  ];

  const report = await runPlan(plan, { execute: true });

  assert.deepEqual(report.summary, { passed: 1, failed: 1, blocked: 0, skipped: 0 });
  assert.equal(report.results[0].status, "fail");
  assert.equal(report.results[0].exitCode, 7);
  assert.match(report.results[0].stdout, /before exit/);
  assert.match(report.results[0].stderr, /boom/);
  assert.deepEqual(report.results[0].failures, ["Command exited with code 7."]);
  assert.equal(report.results[1].id, "continues");
  assert.equal(report.results[1].status, "pass");

  const json = JSON.parse(renderJson(report));
  assert.deepEqual(json.results.map((item) => item.id), ["fails", "continues"]);
  const markdown = renderMarkdown(report);
  assert.match(markdown, /Failed: 1/);
  assert.match(markdown, /## fails[\s\S]*Exit code: 7[\s\S]*before exit[\s\S]*boom/);
  assert.match(markdown, /## continues[\s\S]*Status: pass/);
});

test("records timeout and spawn errors as fixture failures", async () => {
  const report = await runPlan([
    {
      id: "timeout",
      command: [process.execPath, "-e", "setTimeout(() => {}, 1000)"],
      mode: "executable",
      checks: []
    },
    {
      id: "missing-command",
      command: [join(tmpdir(), "agent-fixture-smoke-command-that-does-not-exist")],
      mode: "executable",
      checks: []
    }
  ], { execute: true, commandTimeoutMs: 20 });

  assert.equal(report.summary.failed, 2);
  assert.equal(report.results[0].timedOut, true);
  assert.match(report.results[0].failures[0], /timed out/);
  assert.equal(report.results[1].timedOut, false);
  assert.match(report.results[1].failures[0], /could not start \(ENOENT\)/);
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

function runCli(...args) {
  return spawnSync(process.execPath, ["bin/agent-fixture-smoke.js", ...args], {
    encoding: "utf8",
  });
}

test("CLI defaults to JSON and retains every fixture path", () => {
  const result = runCli("plan", "fixtures/pass.json", "fixtures/skipped.json");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).plan.length, 2);
});

test("CLI supports explicit JSON and Markdown formats", () => {
  const json = runCli("report", "fixtures/pass.json", "--format", "json");
  assert.equal(json.status, 0, json.stderr);
  assert.doesNotThrow(() => JSON.parse(json.stdout));

  const markdown = runCli("plan", "fixtures/pass.json", "--format", "markdown");
  assert.equal(markdown.status, 0, markdown.stderr);
  assert.match(markdown.stdout, /^# Agent Fixture Smoke Plan/m);
});

test("CLI rejects missing and unsupported format values", () => {
  const missing = runCli("plan", "fixtures/pass.json", "--format");
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /Missing value for --format/);

  const unsupported = runCli("plan", "fixtures/pass.json", "--format", "yaml");
  assert.notEqual(unsupported.status, 0);
  assert.match(unsupported.stderr, /Unsupported format: yaml/);
});

test("CLI rejects unknown commands before loading fixtures", () => {
  const result = runCli("deploy", "fixtures/does-not-exist.json");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown command: deploy/);
  assert.doesNotMatch(result.stderr, /does-not-exist/);
});

test("documented run command works without an explicit format", () => {
  const result = runCli("run", "fixtures/pass.json");
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotThrow(() => JSON.parse(result.stdout));
});
