# JEV bridge — agent instructions

This is an independent, private TypeSafe/Jev integration. `mind-self` stores the owner's private coordination context; do not copy it or customer data into this repository.

- Live documentation: https://docs.typesafe.ai/llms.txt. TypeSafe returns typed judgments and cannot replace a coding agent.
- Deterministic routing, permissions, execution and side effects belong to the consuming application's code, not the model.
- Keep JEV non-authoritative and non-executing. A result is advice only, never an automatic merge, shell command, customer action or process gate.
- No automatic API calls. Calls require explicit user opt-in, server-side secret handling, bounded synthetic or pre-approved data, and a known cost scope.
- No cross-repository tokens, customer tickets or private `mind-self` context in model state or logs.
- Never change the existing Theey implementation implicitly. Adapters for other projects require separate task authorization.
- GitHub Actions uses either explicit manual dispatch or a dedicated owner-authorized commit to `jev-requests/current.json` on protected `main` for one fixed synthetic smoke. Never trigger on arbitrary source commits, PRs or forks. A commit request is an execution/cost authorization action, not generic repository maintenance. Private hosted minutes may be exhausted. Never route tests to an owner workstation automatically.
- Keep every security-sensitive change reviewable and record pass/fail evidence.
