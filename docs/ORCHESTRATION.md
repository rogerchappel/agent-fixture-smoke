# Orchestration

1. Convert agent examples into JSON fixtures.
2. Generate a plan in Markdown.
3. Run only fixtures that allow execution.
4. Treat forbidden side effects as blocked release evidence.
5. Attach the report to the release-candidate PR.

The default report path is dry-run and does not execute fixture commands.
