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
  const formatIndex = rest.indexOf("--format");
  const format = formatIndex === -1 ? "json" : rest[formatIndex + 1];
  const paths = rest.filter((item, index) => item !== "--format" && index !== formatIndex + 1);
  if (!command || command === "--help" || command === "-h" || paths.length === 0) {
    console.log(usage.trim());
    return;
  }
  const fixtures = await loadFixtures(paths);
  const plan = createPlan(fixtures);
  const report = command === "plan" ? { plan } : await runPlan(plan, { execute: command === "run" });
  if (!["plan", "run", "report"].includes(command)) throw new Error(`Unknown command: ${command}`);
  console.log(format === "markdown" ? renderMarkdown(report) : renderJson(report));
  if (report.summary?.failed > 0 || report.summary?.blocked > 0) process.exitCode = 1;
}
