# Public-release readiness and verification

Status: repository published on 2026-10-16; final automatic PR verification in progress.

## Publication safeguards

- MIT license, CONTRIBUTING.md, SECURITY.md, PR template and CODEOWNERS are present.
- Main branch ruleset `main-public-release` (25234773) is active for `refs/heads/main`: require a pull request and one approving review, dismiss stale reviews, resolve review conversations, prohibit deletion and force pushes.
- Repository admin bypass is **for pull requests only**. This lets the sole maintainer explicitly merge an owner-authored PR without impossible self-approval; it does not permit direct command-line pushes, deletion or force pushes. CODEOWNERS requests review; code-owner approval is not separately required.
- Actions default token permissions are read-only; Actions cannot create or approve PRs. Actions are restricted to this owner and GitHub-created actions, with full commit SHA pinning required.
- **All external contributors require approval** for fork PR workflow runs, including repeat contributors. Approval allows reviewed code to run; it does not supply repository secrets or a write token. Review workflow and script changes before approving.
- Repository auto-merge is disabled. No contributor PR is automatically merged.
- `TYPESAFE_API_KEY` was verified by name as a repository Actions secret; its value was not read or exported. No environment secrets were present. Public source does not grant service credentials or credits.

## Offline PR checks

`.github/workflows/offline-pr-tests.yml` runs `npm test` on `pull_request` events targeting main, using Node.js 22 on GitHub-hosted Ubuntu. Actions are pinned to full commits, checkout does not persist credentials, token access is `contents: read`, and the job timeout is five minutes.

There are no secret references, live API calls, dependencies to install, deployments, self-hosted runners, `pull_request_target` events or privileged follow-up workflows. The tests inject mocked HTTP responses. Actual execution evidence belongs to this PR's checks; a source commit alone does not prove a passing run. The passing check must be added to the main ruleset before final acceptance.

The existing manual workflow remains dispatch-only. Live synthetic checks require a separate credential/cost/execution authorization. Draft paid commit-trigger PR #4 remains unmerged and is not part of this release.

## Privacy review and limitations

The prior review covered known branch trees, history and PR discussions. A fresh pre-publication scan enumerated five branch heads and 34 reachable commits (46 changed-file records), including the three release-setup commits. It found no matches for checked common GitHub/API token, private-key, personal-email or Windows home-path signatures. There were no tags or releases.

This is a best-effort signature review, not proof that no sensitive information exists. It does not cover encoded secrets, unreachable objects or unseen provider data. No private coordination contents, customer records or credential values were copied into this repository.

## Remaining acceptance

- Observe the automatic PR run on GitHub-hosted Ubuntu with Node.js 22 and passing offline tests.
- Require the observed GitHub Actions check in the main ruleset.
- Verify final rule, visibility, fork approval and workflow source readbacks.
- Keep a real external-account fork approval exercise explicitly NOT RUN unless performed.
