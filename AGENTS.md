# JEV bridge — agent instructions

This is an independent TypeSafe/Jev integration. `mind-self` stores the owner's private coordination context; do not copy it or customer data into this repository.

- Live documentation: https://docs.typesafe.ai/llms.txt. TypeSafe returns typed judgments and cannot replace a coding agent.
- Deterministic routing, permissions, execution and side effects belong to the consuming application's code, not the model.
- Keep JEV non-authoritative and non-executing. A result is advice only, never an automatic merge, shell command, customer action or process gate.
- No automatic API calls. Calls require explicit user opt-in, server-side secret handling, bounded synthetic or pre-approved data, and a known cost scope.
- No cross-repository tokens, customer tickets or private `mind-self` context in model state or logs.
- Never change the existing Theey implementation implicitly. Adapters for other projects require separate task authorization.
- Offline pull-request tests use GitHub-hosted Ubuntu and Node.js 22 with read-only permissions and no secrets. Live JEV checks remain manual-only and separately authorized. Never route tests to an owner workstation.
- Keep every security-sensitive change reviewable and record pass/fail evidence.

## GitHub Actions runtime maintenance (owner policy, 2026-10-24)

- **Prevent deprecated action-runtime warnings:** Every workflow's `actions/checkout` and `actions/setup-node` uses a pinned full commit SHA of a current release with `runs.using: node24` (as of 2026-10-24: `checkout` v7.0.1 at `3d3c42e5aac5ba805825da76410c181273ba90b1`; `setup-node` v7.1.0 at `949feb2413d6458794dcd2491c4babbbce0c15c1`). Do not silently restore older Node 20 action SHAs. Check the official action tags, release notes and `action.yml` runtime whenever creating/editing workflows or when GitHub announces a new deprecation.
- **Separate action runtime from tested Node version:** `runs.using: node24` is the runtime of checkout/setup-node actions, whereas `setup-node`'s `node-version: '22'` is deliberately the version executing JEV tests. Never bump the JEV test/runtime version just to remove action deprecation warnings.
- **Validate without spend or live traffic:** Confirm all workflow files use supported action SHAs with no Node 20 runtime; do local/offline tests before any later authorized run. Do not dispatch paid/live workflows or create automatic push triggers for warning verification. New action/runtime deprecations can occur in the future; upgrade pinned actions promptly rather than suppress warnings.
- Routine owner-approved development can go directly to `main` under the verified administrator bypass and separate no-bypass main integrity ruleset; external/security-sensitive contributions remain reviewable. Keep GitHub's anti-force-push and anti-deletion protections.
