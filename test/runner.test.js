import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { loadFixtures } from "../src/fixtures.js";
import { createPlan } from "../src/planner.js";
import { runPlan } from "../src/runner.js";
import { renderJson, renderMarkdown } from "../src/reporter.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");

test("creates dry-run smoke plans from fixtures", async () => {
  const fixtures = await loadFixtures(["fixtures/pass.json"]);
  const plan = createPlan(fixtures);
  assert.equal(plan[0].mode, "executable");
  assert.equal(plan[0].checks[0].type, "stdout-contains");
});

test("rejects malformed fixture field types with path and field diagnostics", async () => {
  const directory = await mkdtemp(join(tmpdir(), "agent-fixture-smoke-schema-"));
  const cases = [
    ["root.json", [], "root must be an object"],
    ["id.json", { id: 3 }, 'field "id" must be a string'],
    ["prompt.json", { prompt: false }, 'field "prompt" must be a string'],
    ["command-scalar.json", { command: "node script.js" }, 'field "command" must be an array of strings'],
    ["command-empty.json", { command: [] }, 'field "command" must be a non-empty array of strings'],
    ["command-element.json", { command: ["node", 3] }, 'field "command[1]" must be a string'],
    ["output.json", { expectedOutput: "ok" }, 'field "expectedOutput" must be an array of strings'],
    ["files.json", { expectedFiles: [true] }, 'field "expectedFiles[0]" must be a string'],
    ["effects.json", { forbiddenEffects: [null] }, 'field "forbiddenEffects[0]" must be a string'],
    ["execute.json", { allowExecute: "yes" }, 'field "allowExecute" must be a boolean'],
  ];

  try {
    for (const [name, fixture, message] of cases) {
      const fixturePath = join(directory, name);
      await writeFile(fixturePath, JSON.stringify(fixture));
      await assert.rejects(loadFixtures([fixturePath]), (error) => {
        assert.match(error.message, new RegExp(`Invalid fixture .*${name.replace(".", "\\.")}`));
        assert.ok(error.message.includes(message), error.message);
        assert.doesNotMatch(error.message, /TypeError/);
        return true;
      });
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
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

test("does not count unexecuted executable fixtures as passed", async () => {
  const fixtures = await loadFixtures(["fixtures/pass.json"]);
  const plan = createPlan(fixtures);

  const report = await runPlan(plan, { execute: false });
  assert.deepEqual(report.summary, { passed: 0, failed: 0, blocked: 0, skipped: 1 });
  assert.equal(report.results[0].status, "skipped");
  assert.deepEqual(report.results[0].notes, ["Checks were not executed in report mode."]);

  const executed = await runPlan(plan, { execute: true });
  assert.deepEqual(executed.summary, { passed: 1, failed: 0, blocked: 0, skipped: 0 });
  assert.equal(executed.results[0].status, "pass");
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

test("CLI reports fixture schema errors without planner TypeErrors", async () => {
  const directory = await mkdtemp(join(tmpdir(), "agent-fixture-smoke-cli-schema-"));
  const fixturePath = join(directory, "invalid.json");
  try {
    await writeFile(fixturePath, JSON.stringify({ expectedOutput: "ok" }));
    const result = runCli("plan", fixturePath);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid fixture .*invalid\.json: field "expectedOutput" must be an array of strings/);
    assert.doesNotMatch(result.stderr, /TypeError|\.map is not a function/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("CLI supports explicit JSON and Markdown formats", () => {
  const json = runCli("report", "fixtures/pass.json", "--format", "json");
  assert.equal(json.status, 1, json.stderr);
  const report = JSON.parse(json.stdout);
  assert.deepEqual(report.summary, { passed: 0, failed: 0, blocked: 0, skipped: 1 });
  assert.equal(report.results[0].status, "skipped");

  const run = runCli("run", "fixtures/pass.json", "--format", "json");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout).summary, { passed: 1, failed: 0, blocked: 0, skipped: 0 });

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

test("CLI rejects unknown options before loading fixtures", () => {
  const result = runCli("plan", "fixtures/does-not-exist.json", "--bogus");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown option: --bogus/);
  assert.doesNotMatch(result.stderr, /ENOENT|does-not-exist/);
});

test("CLI rejects duplicate format options before loading fixtures", () => {
  const result = runCli(
    "plan",
    "fixtures/does-not-exist.json",
    "--format",
    "json",
    "--format",
    "markdown",
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Option --format may only be specified once/);
  assert.doesNotMatch(result.stderr, /ENOENT|does-not-exist/);
});

test("CLI accepts option-like fixture paths after the option terminator", () => {
  const result = runCli("plan", "--", "--bogus");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ENOENT/);
  assert.match(result.stderr, /--bogus/);
  assert.doesNotMatch(result.stderr, /Unknown option/);
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
