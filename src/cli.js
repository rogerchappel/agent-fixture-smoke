import { loadFixtures } from "./fixtures.js";
import { createPlan } from "./planner.js";
import { runPlan } from "./runner.js";
import { renderJson, renderMarkdown } from "./reporter.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");

const usage = `Usage:
  agent-fixture-smoke plan <fixture...> [--format json|markdown]
  agent-fixture-smoke run <fixture...> [--format json|markdown]
  agent-fixture-smoke report <fixture...> [--format json|markdown]
`;

function parseArguments(args) {
  const paths = [];
  let format = "json";
  let hasFormat = false;
  let optionsEnded = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!optionsEnded && argument === "--") {
      optionsEnded = true;
    } else if (!optionsEnded && argument === "--format") {
      if (hasFormat) throw new Error("Option --format may only be specified once");
      const value = args[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("Missing value for --format (expected json or markdown)");
      }
      format = value;
      hasFormat = true;
      index += 1;
    } else if (!optionsEnded && argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      paths.push(argument);
    }
  }

  if (!["json", "markdown"].includes(format)) {
    throw new Error(`Unsupported format: ${format}`);
  }
  return { format, paths };
}

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
  const { format, paths } = parseArguments(rest);
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
