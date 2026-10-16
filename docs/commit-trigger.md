# Commit-triggered JEV synthetic smoke

This is the same **request-file commit** technique used in `anilist-mcp-server`.
It is not a general coding agent, not a webhook for every source change, and not a
replacement for the manually dispatched `jev-manual-check.yml`.

## Trigger and authorization

The separate workflow `.github/workflows/jev-commit-request.yml` starts only when
`jev-requests/current.json` **changes on trusted `main`**. A PR, source-only
commit, README edit, or feature branch push will not trigger a live request.
The workflow runs offline regression tests before a single hard-coded synthetic
TypeSafe Choice request. It cannot invoke arbitrary tools or read private project
data. The provided JSON is used only as a local authorization marker and is not
sent to JEV.

For each separately authorized one-time test, commit the following **new or
updated** file to `main`, changing the `requestId` per invocation:

```json
{
  "approved": true,
  "fixture": "browser-tab",
  "kind": "live-synthetic-smoke",
  "requestId": "jev-20261016-a1b2c3d4"
}
```

This example is **documentation only**. The request file is intentionally **not
committed** as part of the workflow setup PR, because doing so could immediately
trigger usage on merge. An `approved` field documents the operator's intent;
it does not substitute for actual owner authorization. The request ID is an
audit marker, not an exactly-once guarantee: distinct pushes may make distinct
paid calls. The workflow skips re-runs with `github.run_attempt > 1`.

## Before pushing any live request

- Confirm the owner has approved this specific test and its model/API cost.
- Confirm GitHub-hosted **private** Actions minute capacity (the owner's allowance
  was recorded at 2,000/2,000 on 2026-10-11, resetting 2026-11-01). Do not enable
  paid overage or change repository visibility just for a test.
- Ensure `TYPESAFE_API_KEY` is a dedicated, restricted repository secret; do not
  paste or export it. Anyone allowed to change trusted workflow code may affect
  how the secret is used, so protect `main` and review workflow changes.
- Verify an actual Action run ID, job result, and `JEV SYNTHETIC READ-ONLY PASS`
  marker in its logs. A commit, skipped run, or green offline test is **not**
  proof of live interoperability.

The runner is `ubuntu-latest` hosted by GitHub. It does **not** execute on
the owner's Windows machine or reuse GhostView's repo-specific self-hosted runner.
The existing manual `workflow_dispatch` route remains intact. No production
Theey/GhostView/Intent Core/Anima integration is authorized by this workflow.
