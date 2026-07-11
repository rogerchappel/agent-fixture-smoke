# agent-fixture-smoke

`agent-fixture-smoke` turns small agent workflow fixtures into deterministic smoke plans and release evidence. It is designed for skill, connector, and action-plan repos that need local checks without calling live LLMs or remote services.

## Quickstart

```bash
npm install
npm test
node bin/agent-fixture-smoke.js plan fixtures/pass.json --format markdown
node bin/agent-fixture-smoke.js run fixtures/pass.json
node bin/agent-fixture-smoke.js report fixtures/blocked.json --format markdown
```

## Fixture Shape

Fixtures are JSON files with `prompt`, optional `command`, `expectedOutput`, `expectedFiles`, `forbiddenEffects`, and `allowExecute`.

## Safety Notes

Commands run only when the fixture sets `allowExecute: true` and the caller uses `run`. The `report` command stays in dry-run mode and is suitable for release notes.

## Limitations

This tool checks deterministic local commands. It does not call LLMs, browse websites, or validate subjective response quality.
