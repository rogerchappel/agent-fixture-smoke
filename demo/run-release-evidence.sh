#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out_dir="${1:-$repo_root/tmp/demo-release-evidence}"

rm -rf "$out_dir"
mkdir -p "$out_dir"

node "$repo_root/bin/agent-fixture-smoke.js" plan \
  "$repo_root/fixtures/pass.json" \
  "$repo_root/fixtures/blocked.json" \
  --format markdown > "$out_dir/plan.md"

node "$repo_root/bin/agent-fixture-smoke.js" run \
  "$repo_root/fixtures/pass.json" \
  --format markdown > "$out_dir/run.md"

node "$repo_root/bin/agent-fixture-smoke.js" report \
  "$repo_root/fixtures/pass.json" \
  "$repo_root/fixtures/blocked.json" \
  "$repo_root/fixtures/skipped.json" \
  --format markdown > "$out_dir/report.md"

grep -q "Agent Fixture Smoke Plan" "$out_dir/plan.md"
grep -q "Status: pass" "$out_dir/run.md"
grep -q "Agent Fixture Smoke Report" "$out_dir/report.md"

echo "wrote demo release evidence to $out_dir"
