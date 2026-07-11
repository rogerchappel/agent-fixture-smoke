import { access } from "node:fs/promises";

for (const file of ["README.md", "SKILL.md", "docs/PRD.md", "docs/TASKS.md", "docs/ORCHESTRATION.md"]) {
  await access(file);
}
console.log("check ok");
