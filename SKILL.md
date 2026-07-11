# agent-fixture-smoke

Use this skill when a repo has agent workflow examples that should become repeatable smoke evidence.

## Inputs

- One or more JSON fixtures.
- Optional local commands that are safe to execute.

## Workflow

1. Write fixtures with expected output, expected files, and forbidden side effects.
2. Run `agent-fixture-smoke plan <fixtures> --format markdown`.
3. Run `agent-fixture-smoke run <fixtures>` only for fixtures that explicitly set `allowExecute: true`.
4. Include `agent-fixture-smoke report <fixtures> --format markdown` output in release-candidate notes.

## Boundaries

Do not use this skill to call live LLMs or write to external accounts. Remote posting, repository pushes, and credentialed connector actions belong in dry-run fixtures unless separately approved.

## Validation

Run `npm test`, `npm run smoke`, and `bash scripts/validate.sh`.
