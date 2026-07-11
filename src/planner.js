export function createPlan(fixtures) {
  return fixtures.map((fixture) => ({
    id: fixture.id,
    path: fixture.path,
    prompt: fixture.prompt,
    command: fixture.command,
    mode: fixture.allowExecute ? "executable" : "dry-run",
    checks: [
      ...fixture.expectedOutput.map((value) => ({ type: "stdout-contains", value })),
      ...fixture.expectedFiles.map((value) => ({ type: "file-exists", value })),
      ...fixture.forbiddenEffects.map((value) => ({ type: "forbidden-effect", value }))
    ]
  }));
}
