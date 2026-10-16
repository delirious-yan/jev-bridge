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
