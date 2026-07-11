export function renderJson(report) {
  return JSON.stringify(report, null, 2);
}

export function renderMarkdown(report) {
  if (report.plan) return renderPlan(report.plan);
  const lines = ["# Agent Fixture Smoke Report", ""];
  lines.push(`Passed: ${report.summary.passed}`);
  lines.push(`Failed: ${report.summary.failed}`);
  lines.push(`Blocked: ${report.summary.blocked}`);
  lines.push(`Skipped: ${report.summary.skipped}`, "");
  for (const item of report.results) {
    lines.push(`## ${item.id}`, "", `Status: ${item.status}`, "");
    for (const note of item.notes ?? []) lines.push(`- ${note}`);
    for (const failure of item.failures ?? []) lines.push(`- ${failure}`);
  }
  return lines.join("\n");
}

function renderPlan(plan) {
  const lines = ["# Agent Fixture Smoke Plan", ""];
  for (const item of plan) {
    lines.push(`## ${item.id}`, "", `Mode: ${item.mode}`, `Command: ${item.command ? item.command.join(" ") : "none"}`, "");
    for (const check of item.checks) lines.push(`- ${check.type}: ${check.value}`);
  }
  return lines.join("\n");
}
