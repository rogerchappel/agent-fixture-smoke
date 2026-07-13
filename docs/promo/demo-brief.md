# Demo brief: fixture-backed release evidence

## Hook

"Before an agent workflow ships, show the fixture evidence instead of asking a
reviewer to trust the prompt."

## 45-second recording outline

1. Show `fixtures/pass.json`, `fixtures/blocked.json`, and `fixtures/skipped.json`.
2. Run `bash demo/run-release-evidence.sh`.
3. Open `tmp/demo-release-evidence/plan.md` to show the dry-run command plan.
4. Open `tmp/demo-release-evidence/run.md` to show the executable fixture passed.
5. Open `tmp/demo-release-evidence/report.md` to show pass, blocked, and skipped
   status in one reviewable artifact.

## Social hooks

- Turn agent workflow fixtures into release evidence with one local command.
- Keep blocked actions visible without running them in CI.
- Give reviewers Markdown evidence instead of a vague "tested locally" note.

## Grounding notes

The demo uses only checked-in fixtures and the local CLI. It does not call LLMs,
browse websites, upload files, or execute blocked fixtures.
