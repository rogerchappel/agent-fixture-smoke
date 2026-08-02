import { access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function runPlan(plan, options = {}) {
  const results = [];
  for (const item of plan) {
    results.push(await runItem(item, options));
  }
  const summary = {
    passed: results.filter((item) => item.status === "pass").length,
    failed: results.filter((item) => item.status === "fail").length,
    blocked: results.filter((item) => item.status === "blocked").length,
    skipped: results.filter((item) => item.status === "skipped").length
  };
  return { summary, results };
}

async function runItem(item, options) {
  if (!item.command) return { id: item.id, status: "skipped", notes: ["No command provided."] };
  if (item.checks.some((check) => check.type === "forbidden-effect")) {
    return { id: item.id, status: "blocked", notes: ["Fixture declares forbidden side effects."] };
  }
  if (item.mode !== "executable" || !options.execute) {
    return { id: item.id, status: "pass", notes: ["Dry-run plan only."], checks: item.checks };
  }
  let stdout;
  try {
    ({ stdout } = await execFileAsync(item.command[0], item.command.slice(1), {
      timeout: options.commandTimeoutMs ?? 5000
    }));
  } catch (error) {
    return commandFailure(item.id, error);
  }
  const failures = [];
  for (const check of item.checks) {
    if (check.type === "stdout-contains" && !stdout.includes(check.value)) failures.push(`Missing stdout: ${check.value}`);
    if (check.type === "file-exists") {
      try {
        await access(check.value);
      } catch {
        failures.push(`Missing file: ${check.value}`);
      }
    }
  }
  return { id: item.id, status: failures.length ? "fail" : "pass", stdout, failures };
}

function commandFailure(id, error) {
  const timedOut = error.killed === true && error.signal != null;
  const reason = timedOut
    ? `Command timed out${error.signal ? ` (${error.signal})` : ""}.`
    : typeof error.code === "number"
      ? `Command exited with code ${error.code}.`
      : `Command could not start${error.code ? ` (${error.code})` : ""}.`;

  return {
    id,
    status: "fail",
    stdout: error.stdout ?? "",
    stderr: error.stderr ?? "",
    exitCode: typeof error.code === "number" ? error.code : null,
    signal: error.signal ?? null,
    timedOut,
    failures: [reason]
  };
}
