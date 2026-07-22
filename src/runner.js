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
  const { stdout } = await execFileAsync(item.command[0], item.command.slice(1), { timeout: 5000 });
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
