# agent-fixture-smoke

`agent-fixture-smoke` turns small agent workflow fixtures into deterministic smoke plans and release evidence. It is designed for skill, connector, and action-plan repos that need local checks without calling live LLMs or remote services.

Node.js 20.0.0 or newer is required. CI verifies both the exact minimum and the
current Node 20 release.

## Quickstart

```bash
npm install
npm test
npm run release:check
node bin/agent-fixture-smoke.js --version
node bin/agent-fixture-smoke.js plan fixtures/pass.json --format markdown
node bin/agent-fixture-smoke.js run fixtures/pass.json
node bin/agent-fixture-smoke.js report fixtures/blocked.json --format markdown
```

`--format` may be provided once, before or after fixture paths. Unknown options
and duplicate `--format` options are rejected before any fixture is opened. To
use a fixture path beginning with `-`, place it after the option terminator:

```bash
node bin/agent-fixture-smoke.js plan -- --option-like-fixture.json
```

## Demo

Generate a small release evidence packet from the checked-in fixtures:

```bash
bash demo/run-release-evidence.sh
```

See [docs/tutorials/release-evidence-from-fixtures.md](docs/tutorials/release-evidence-from-fixtures.md)
for the walkthrough and [docs/promo/demo-brief.md](docs/promo/demo-brief.md)
for a short video outline and social hooks.

## Fixture Shape

Fixtures are JSON objects. All fields are optional; an omitted `id` defaults to
the fixture filename, while omitted check arrays default to empty arrays.

```json
{
  "id": "prints-version",
  "prompt": "Confirm the local tool version",
  "command": ["node", "bin/tool.js", "--version"],
  "expectedOutput": ["1.0.0"],
  "expectedFiles": ["package.json"],
  "forbiddenEffects": [],
  "allowExecute": true
}
```

`id` and `prompt` must be strings. `command`, when present, must be a non-empty
array of strings: its first item is the executable and the remaining items are
passed as arguments. `expectedOutput`, `expectedFiles`, and `forbiddenEffects`
must be arrays containing only strings. `allowExecute` must be a boolean.
Malformed fixtures are rejected before planning with an error naming the
fixture path and invalid field.

## Safety Notes

Commands run only when the fixture sets `allowExecute: true` and the caller uses `run`. The `report` command stays in dry-run mode and is suitable for release notes.

Executable fixtures are isolated from one another at the reporting boundary. If a command exits nonzero, times out after five seconds, or cannot start, its result is marked `fail` with available exit, signal, stdout, and stderr diagnostics. Later fixtures still run, the complete JSON or Markdown report is printed, and the CLI exits nonzero after reporting all results.

## Limitations

This tool checks deterministic local commands. It does not call LLMs, browse websites, or validate subjective response quality.

## Release Verification

Run the same gate used by CI before cutting a release or handing the package to another agent:

```bash
npm run release:check
```

The release check runs syntax checks, the Node test suite, CLI smoke coverage,
and a packed-package install and version smoke. The package smoke also checks
that the demo script, tutorial, and promo brief remain publishable with the CLI.
