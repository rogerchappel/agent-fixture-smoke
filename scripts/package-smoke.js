#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const [pack] = JSON.parse(result.stdout);
const files = new Set(pack.files.map((file) => file.path));
const required = [
  'bin/agent-fixture-smoke.js',
  'src/runner.js',
  'src/reporter.js',
  'scripts/check.js',
  'fixtures/pass.json',
  'fixtures/blocked.json',
  'docs/RELEASE_CANDIDATE.md',
  'SKILL.md',
  'README.md',
  'CHANGELOG.md',
  'LICENSE',
  'package.json',
];

const missing = required.filter((file) => !files.has(file));

if (missing.length > 0) {
  console.error(`Package smoke failed; missing from npm pack: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`Package smoke passed with ${pack.files.length} files.`);
