import { loadFixtures } from "./fixtures.js";
import { createPlan } from "./planner.js";
import { runPlan } from "./runner.js";
import { renderJson, renderMarkdown } from "./reporter.js";
import packageJson from "../package.json" with { type: "json" };

const usage = `Usage:
  agent-fixture-smoke plan <fixture...> [--format json|markdown]
  agent-fixture-smoke run <fixture...> [--format json|markdown]
  agent-fixture-smoke report <fixture...> [--format json|markdown]
`;

export async function main(argv) {
  const [command, ...rest] = argv;
  if (command === "--version" || command === "-v") {
    console.log(packageJson.version);
    return;
  }
  if (!command || command === "--help" || command === "-h") {
    console.log(usage.trim());
    return;
  }
  if (!["plan", "run", "report"].includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }
  const formatIndex = rest.indexOf("--format");
  const format = formatIndex === -1 ? "json" : rest[formatIndex + 1];
  if (formatIndex !== -1 && !format) {
    throw new Error("Missing value for --format (expected json or markdown)");
  }
  if (!["json", "markdown"].includes(format)) {
    throw new Error(`Unsupported format: ${format}`);
  }
  const paths = formatIndex === -1
    ? rest
    : rest.filter((_, index) => index !== formatIndex && index !== formatIndex + 1);
  if (paths.length === 0) {
    console.log(usage.trim());
    return;
  }
  const fixtures = await loadFixtures(paths);
  const plan = createPlan(fixtures);
  const report = command === "plan" ? { plan } : await runPlan(plan, { execute: command === "run" });
  console.log(format === "markdown" ? renderMarkdown(report) : renderJson(report));
  if (report.summary?.failed > 0 || report.summary?.blocked > 0) process.exitCode = 1;
}
