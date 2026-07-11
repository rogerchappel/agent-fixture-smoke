import { access } from "node:fs/promises";

await access("bin/agent-fixture-smoke.js");
await access("src/runner.js");
console.log("build ok");
