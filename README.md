# jev-bridge

A **read-only, dependency-free Jev/TypeSafe adapter** for future GitHub projects. It asks one bounded semantic `choice` question and returns a typed **advisory**; it cannot execute commands, push code, merge PRs, or perform customer actions.

TypeSafe Jev is a structured decision model—not a chat or coding-agent replacement. This bridge deliberately keeps any execution/authorization logic inside the consuming application.

## Setup

Node.js 22+ is required. No dependencies or `npm install` step are needed.

```bash
npm test
```

All tests use mocked HTTP responses: **no JEV credits, GitHub Actions minutes, or API key required**.

## Use

```js
import { evaluateChoice } from "./src/jev.mjs";

const result = await evaluateChoice({
  state: { requestedAction: "Show me the previous browser tab" },
  instructions: "Which browser navigation action is requested?",
  criteria: {
    previous: "Switch to the previous existing tab",
    new_tab: "Create a new tab",
    no_match: "Neither option is appropriate",
  },
  apiKey: process.env.TYPESAFE_API_KEY,
  allowNetwork: true, // explicit opt-in; may incur TypeSafe charges
});
// result.status: advisory | unavailable
// result.executionEffect: always "none" (the caller owns policy and actions)
```

Without `allowNetwork: true`, no network request runs. Without a key, even opted-in calls return `unavailable`. Input is capped at 4,000 serialized characters; requests cannot change the upstream endpoint or execute an action. Errors never expose API keys or private response bodies. Do not pass private repositories, personal context, customer tickets, or credentials into model state without separate data-handling approval.

## GitHub Actions

`.github/workflows/jev-manual-check.yml` is **manual-only**:
- `offline-tests`: unit tests, **no API secret** or model call.
- `live-synthetic`: tests then **one** synthetic, read-only TypeSafe request using GitHub's `TYPESAFE_API_KEY` repository secret; requires explicit owner authorization and may incur JEV cost.

`.github/workflows/offline-pr-tests.yml` automatically runs `npm test` for pull requests targeting `main`, using GitHub-hosted Ubuntu and Node.js 22. It has read-only repository permissions, pinned actions, no persisted checkout credential, no secrets, no deployment, and no live JEV calls. External fork runs require maintainer approval under the repository's Actions policy.

The manual workflow has not been dispatched. Live checks require separate authorization for credentials, cost and execution. Never redirect any job to the owner's workstation.

## Synthetic decision benchmark (not yet run live)

The separate manual-only `.github/workflows/jev-benchmark.yml` prepares a five-case, three-trial synthetic decision benchmark (15 evaluations maximum). It is **not** run on PRs or pushes. Use `node scripts/benchmark.mjs --dry-run` locally without a secret or model call; see [benchmark safety and review instructions](docs/JEV-BENCHMARK.md). Live use requires a separate owner decision about TypeSafe cost, review/merge into protected `main`, and explicit manual dispatch. No upstream benchmark results are claimed yet.

## Contributions and license

JEV Bridge is MIT-licensed; see [LICENSE](LICENSE). The bridge source may be
reused independently, but this repository does not supply TypeSafe API credits
or anyone else's secret credentials.

To propose a change, fork the repository and open a pull request. See
[CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
The maintainer retains merge control; no third-party fork PR may access
TypeSafe secrets or run live model traffic. Review the
[public-release readiness gates](docs/PUBLIC-RELEASE-CHECKLIST.md)
before making the repository publicly visible.

## Integration plan

Use this standalone adapter in a separately authorized, reviewed consuming project. Keep `theey-base` production unchanged. Persist architecture decisions in the private `mind-self` repository, not sensitive state in the bridge.

Official reference: https://docs.typesafe.ai/sdk/javascript and https://docs.typesafe.ai/introduction/coding-agents
