# Public-release readiness and verification

Status: public-release setup configured and acceptance reviewed on 2026-10-16. Automatic PR checks passed; final revision checks remain visible in PR #6.

## Publication safeguards

- MIT license, CONTRIBUTING.md, SECURITY.md, PR template and CODEOWNERS are present.
- Main branch ruleset `main-public-release` (25234773) is active for `refs/heads/main`: require a pull request and one approving review, dismiss stale reviews, resolve review conversations, prohibit deletion and force pushes.
- Repository admin bypass is **for pull requests only**. This lets the sole maintainer explicitly merge an owner-authored PR without impossible self-approval; it does not permit direct command-line pushes, deletion or force pushes. CODEOWNERS requests review; code-owner approval is not separately required.
- Actions default token permissions are read-only; Actions cannot create or approve PRs. Actions are restricted to this owner and GitHub-created actions, with full commit SHA pinning required.
- **All external contributors require approval** for fork PR workflow runs, including repeat contributors. Approval allows reviewed code to run; it does not supply repository secrets or a write token. Review workflow and script changes before approving.
- Repository auto-merge is disabled. No contributor PR is automatically merged.
- Private vulnerability reporting, secret scanning and secret push protection are enabled at no additional license cost.
- `TYPESAFE_API_KEY` was verified by name as a repository Actions secret; its value was not read or exported. No environment secrets were present. Public source does not grant service credentials or credits.

## Offline PR checks

`.github/workflows/offline-pr-tests.yml` runs `npm test` on `pull_request` events targeting main, using Node.js 22 on GitHub-hosted Ubuntu. Actions are pinned to full commits, checkout does not persist credentials, token access is `contents: read`, and the job timeout is five minutes.

There are no secret references, live API calls, dependencies to install, deployments, self-hosted runners, `pull_request_target` events or privileged follow-up workflows. The tests inject mocked HTTP responses. Automatic PR [run 38892287410](https://github.com/delirious-yan/jev-bridge/actions/runs/38892287410) passed **12/12 tests**, zero failures, using Ubuntu 24.04 and Node.js v22.23.3. The log confirms Contents/Metadata read permissions and credential removal before tests. The main ruleset now requires `Node 22 offline tests` from GitHub Actions (integration 15368), with the branch up to date before merging.

The existing manual workflow remains dispatch-only. Live synthetic checks require a separate credential/cost/execution authorization. Draft paid commit-trigger PR #4 remains unmerged and is not part of this release.

## Privacy review and limitations

The prior review covered known branch trees, history and PR discussions. A fresh pre-publication scan enumerated five branch heads and 34 reachable commits (46 changed-file records), including the three release-setup commits. It found no matches for checked common GitHub/API token, private-key, personal-email or Windows home-path signatures. There were no tags or releases.

This is a best-effort signature review, not proof that no sensitive information exists. It does not cover encoded secrets, unreachable objects or unseen provider data. No private coordination contents, customer records or credential values were copied into this repository.

## Acceptance evidence and limits

- **PASS:** public visibility; main protected; active rule targets main with PR-only admin bypass, PR review requirement, force-push/deletion prohibition and required GitHub Actions check. GitHub API readback verified rule content.
- **PASS:** automatic `pull_request` execution and 12 offline regressions on standard GitHub-hosted Ubuntu/Node.js 22; source review confirms no JEV secret references or live-call steps.
- **PASS:** GitHub Settings readback shows all external contributors require approval; read-only default workflow permissions; Actions PR creation/approval disabled; action pinning required; private vulnerability reporting, secret scanning and push protection enabled.
- **NOT RUN:** an actual second-account fork approval exercise, deliberate force-push/deletion attempts, live JEV requests, deployments and self-hosted jobs. Configuration readbacks verify those controls; do not claim destructive negative tests or live interoperability.
- Source acceptance reviewed against the authorized public-release objectives. Deprecation notices for the pinned actions' internal runtime did not affect the Node.js 22 test runtime or passing result.

The maintainer must inspect workflow/script changes before approving external runs and decide each merge. Revalidate controls after future repository-settings or workflow changes.
