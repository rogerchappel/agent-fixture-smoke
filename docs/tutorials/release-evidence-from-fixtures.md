# Release evidence from fixtures

This walkthrough turns the checked-in fixtures into a small release evidence
packet. It is useful when a skill, connector, or agent workflow needs proof that
its local deterministic checks still pass without calling live services.

## Run the demo

```bash
bash demo/run-release-evidence.sh
```

The script writes three Markdown files under `tmp/demo-release-evidence/`:

- `plan.md` previews fixture commands and expected checks; it has no outcomes.
- `run.md` executes only the fixture that opts in with `allowExecute` and records
  genuine pass evidence.
- `report.md` describes dry-run outcomes. Unexecuted executable checks are
  `skipped`, while forbidden effects are `blocked`; this demo report exits 1.

## Inspect the fixtures

The demo uses the repository fixtures directly:

- `fixtures/pass.json` runs `node -e console.log('hello smoke')` and expects the
  output to contain `hello smoke`.
- `fixtures/blocked.json` documents an action that should stay in dry-run mode.
- `fixtures/skipped.json` records a skipped fixture for incomplete prerequisites.

## Use the pattern in another repo

1. Add one fixture for the smallest executable success path.
2. Add blocked or skipped fixtures for workflows that should not run in CI.
3. Use `plan` for previews, `report` for explicitly unverified dry-run evidence,
   and `run` for completed verification. `report` and `run` exit 1 when any
   result is failed, blocked, or skipped.
4. Commit only the fixtures and docs; keep generated evidence in CI artifacts or
   temporary release notes unless the project intentionally versions it.

The important rule is that `run` should execute only commands the fixture owner
has reviewed and marked with `allowExecute: true`.
