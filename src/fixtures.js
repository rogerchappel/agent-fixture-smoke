import { readFile } from "node:fs/promises";
import path from "node:path";

export async function loadFixtures(paths) {
  const fixtures = [];
  for (const fixturePath of paths) {
    const raw = JSON.parse(await readFile(fixturePath, "utf8"));
    validateFixture(raw, fixturePath);
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

function validateFixture(fixture, fixturePath) {
  if (fixture === null || typeof fixture !== "object" || Array.isArray(fixture)) {
    throw new Error(`Invalid fixture ${fixturePath}: root must be an object.`);
  }

  optionalString(fixture, fixturePath, "id", { nonBlank: true });
  optionalString(fixture, fixturePath, "prompt");
  optionalStringArray(fixture, fixturePath, "command", { nonEmpty: true, nonBlank: true });
  optionalStringArray(fixture, fixturePath, "expectedOutput", { nonBlank: true });
  optionalStringArray(fixture, fixturePath, "expectedFiles", { nonBlank: true });
  optionalStringArray(fixture, fixturePath, "forbiddenEffects", { nonBlank: true });

  if ("allowExecute" in fixture && typeof fixture.allowExecute !== "boolean") {
    invalidField(fixturePath, "allowExecute", "must be a boolean");
  }
}

function optionalString(fixture, fixturePath, field, options = {}) {
  if (field in fixture && typeof fixture[field] !== "string") {
    invalidField(fixturePath, field, "must be a string");
  }
  if (options.nonBlank && field in fixture && fixture[field].trim() === "") {
    invalidField(fixturePath, field, "must be a nonblank string");
  }
}

function optionalStringArray(fixture, fixturePath, field, options = {}) {
  if (!(field in fixture)) return;
  const value = fixture[field];
  if (!Array.isArray(value)) invalidField(fixturePath, field, "must be an array of strings");
  if (options.nonEmpty && value.length === 0) {
    invalidField(fixturePath, field, "must be a non-empty array of strings");
  }
  const invalidIndex = value.findIndex((item) => typeof item !== "string");
  if (invalidIndex !== -1) {
    invalidField(fixturePath, `${field}[${invalidIndex}]`, "must be a string");
  }
  if (options.nonBlank) {
    const blankIndex = value.findIndex((item) => item.trim() === "");
    if (blankIndex !== -1) {
      invalidField(fixturePath, `${field}[${blankIndex}]`, "must be a nonblank string");
    }
  }
}

function invalidField(fixturePath, field, requirement) {
  throw new Error(`Invalid fixture ${fixturePath}: field \"${field}\" ${requirement}.`);
}
