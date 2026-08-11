#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');
const directory = await mkdtemp(join(tmpdir(), 'agent-fixture-smoke-package-'));

try {
  const result = spawnSync('npm', ['pack', '--json', '--pack-destination', directory], {
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
  'demo/run-release-evidence.sh',
  'fixtures/pass.json',
  'fixtures/blocked.json',
  'docs/RELEASE_CANDIDATE.md',
  'docs/tutorials/release-evidence-from-fixtures.md',
  'docs/promo/demo-brief.md',
  'SKILL.md',
  'README.md',
  'CHANGELOG.md',
  'LICENSE',
  'package.json',
  ];

  const missing = required.filter((file) => !files.has(file));

  if (missing.length > 0) {
    console.error(`Package smoke failed; missing from npm pack: ${missing.join(', ')}`);
    process.exitCode = 1;
  } else {
    const installDirectory = join(directory, 'install');
    const tarball = join(directory, pack.filename);
    const install = spawnSync('npm', ['install', '--ignore-scripts', '--prefix', installDirectory, tarball], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (install.status !== 0) {
      process.stderr.write(install.stderr);
      process.exitCode = install.status ?? 1;
    } else {
      const cli = join(installDirectory, 'node_modules', '.bin', 'agent-fixture-smoke');
      const version = spawnSync(cli, ['--version'], { encoding: 'utf8' });
      if (version.status !== 0 || version.stdout.trim() !== packageJson.version) {
        process.stderr.write(version.stderr);
        console.error(`Packed CLI version smoke failed: expected ${packageJson.version}, received ${version.stdout.trim()}`);
        process.exitCode = version.status ?? 1;
      } else {
        console.log(`Package smoke passed with ${pack.files.length} files and CLI version ${packageJson.version}.`);
      }
    }
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
