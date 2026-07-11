import { readFile } from "node:fs/promises";
import path from "node:path";

export async function loadFixtures(paths) {
  const fixtures = [];
  for (const fixturePath of paths) {
    const raw = JSON.parse(await readFile(fixturePath, "utf8"));
    fixtures.push({
      id: raw.id ?? path.basename(fixturePath, ".json"),
      path: fixturePath,
      prompt: raw.prompt ?? "",
      command: raw.command ?? null,
      expectedOutput: raw.expectedOutput ?? [],
      expectedFiles: raw.expectedFiles ?? [],
      forbiddenEffects: raw.forbiddenEffects ?? [],
      allowExecute: raw.allowExecute === true
    });
  }
  return fixtures;
}
