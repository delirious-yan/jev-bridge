# Public-release readiness checklist

**Status:** PREPARATION ONLY. Do not change this repository to public until all enforcement and review gates below are complete. The repo is currently private. Draft PR #4 (paid JEV commit-trigger workflow) is separate from the contribution guidance.

## Verified in the 2026-10-16 preflight

- Enumerated five known branches; current tracked-file trees on those branches had no obvious sensitive filenames or common hard-coded credential signatures.
- Checked available commit history/patches for these known branches (including source/workflow setup, review, trigger proposal and community docs). No credential-token signatures, direct personal email addresses or Windows user-home-path patterns detected in those checked patches.
- Main's existing commit author uses GitHub's anonymized email; GitHub's own no-reply committer identity is present.
- Inspected the known pull-request discussions and review request issue for the same patterns. No match found.
- Scope limitation: this is a best-effort signature audit, **not a guarantee**: it may miss encoded secrets, ambiguous personal context, off-branch or unreachable objects, historical versions not exposed by the API, unreachable objects, other namespaces outside the enumerated refs, and GitHub settings outside this integration. The GitHub matching-refs/tags endpoint was successfully queried and returned zero tags.

## Required before changing repository visibility

1. **Protect `main`** in GitHub Settings → Rules → Rulesets (or Branch protection): require at least one approval before merge, require code-owner review, prohibit force pushes and deletion, apply to admins if possible, and restrict direct pushes / require pull requests for changes. `.github/CODEOWNERS` requests reviews but cannot enforce anything by itself. Confirm rule actually applies to `main` from GitHub UI. **Current connected GitHub API read of main's protection returned 403** (integration lacks permission) and branch listing shows `protected:false`; the assistant cannot enable protection. GitHub Free supports protected branches on public repositories but not private ones; if your account cannot create the rule while private, prepare every setting first, switch visibility yourself, and immediately enable the rule before inviting contributions.
2. **Require safe offline PR checks**: a `pull_request`-triggered GitHub-hosted job using read-only `contents: read`, no secrets, no `pull_request_target`, no production tokens, no self-hosted owner runner, Node 22 `npm test`. Wait until this job actually exists and successfully runs before marking a required status check. The attempt to create it through the current connected GitHub tool was **blocked by connector safety checks**; it is **not installed**.
3. **Audit security settings**: repository Actions permissions (restrict `GITHUB_TOKEN` to read-only where possible); review authorized GitHub Apps and collaborators; enable private vulnerability reporting and secret scanning/push protection if available. Confirm `TYPESAFE_API_KEY` remains a restricted Actions secret and never reaches fork PR jobs.
4. **Review reachable history and refs** one final time in GitHub and/or a locally authenticated Git client: all branches, tags, merged and unmerged PRs, author metadata, release artifacts, and commit notes. Remove sensitive data via proper history remediation *before* exposure; assume visibility cannot undo copies once public.
5. **License approval**: review the MIT `LICENSE` with copyright holder `delirious-yan`; public visitors may use/distribute the code under MIT but do not receive the TypeSafe API service or owner's credits.
6. **Separate JEV execution permission**: leave `jev-commit-request.yml` in PR #4 unmerged until specifically approved for the final deployment posture. Nothing may automatically make paid calls from a fork PR. Per-request main-branch invocation remains an explicit decision.

## Publication checkpoint

Only after successful confirmation of protection, CI, licensing and private-data review should the owner decide to change the repository visibility to **Public** through GitHub Settings → General → Danger Zone. Publishing makes source, history and public discussion visible; public visibility is not an automated result of merging documentation.

**Never** assume a public repository enables stranger write access; forks and PRs are suggestions. Do not enable auto-merges for untrusted changes merely to reduce review effort.
