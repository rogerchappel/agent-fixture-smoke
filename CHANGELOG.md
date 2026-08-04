# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

- Reject unknown and duplicate CLI options before loading fixtures, with `--`
  available to terminate option parsing for option-like fixture paths.

## 0.1.0 - Initial release candidate

- Added deterministic fixture planning, running, and release-evidence reporting.
- Included pass, blocked, and skipped fixture examples for local smoke coverage.
- Added CLI entry points for `plan`, `run`, and `report` workflows.
