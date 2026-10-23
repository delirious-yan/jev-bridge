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

The one-call `jev-manual-check.yml` workflow remains separate from the completed benchmark; any new live check requires fresh authorization for credentials, cost and execution. Never redirect any job to the owner's workstation.

## Synthetic decision benchmark (first live batch complete)

The manual-only `.github/workflows/jev-benchmark.yml` runs five public synthetic decision cases, each with three rotating answer orders (15 evaluations maximum). It **never** runs on PRs, pushes or schedules. Locally use `node scripts/benchmark.mjs --dry-run` without secrets or TypeSafe calls; see [benchmark safety and evidence](docs/JEV-BENCHMARK.md).

On 2026-10-24 PHT, the owner manually dispatched [GitHub Actions run 40004120477](https://github.com/delirious-yan/jev-bridge/actions/runs/40004120477), first attempt on commit `eb1c20a`, using requested and returned model `jev-1.14.0`. **15/15 choices matched the precommitted synthetic rubric**, with **zero critical failures** and **zero overconfident wrong answers**. This is a limited proof of live advisory API interoperability on those five cases, **not** a general production-safety or independently sampled model accuracy claim. It consumed up to 15 TypeSafe calls; actual account charges are not established.

**GitHub Actions runtime hygiene:** Workflows now use full-SHA pins for `actions/checkout` **v7.0.1** and `actions/setup-node` **v7.1.0**, whose own action runtimes are **Node 24**, avoiding the prior "Node.js 20 is deprecated" warning from the old pinned versions. The project's actual test process remains **Node 22**. See `AGENTS.md` for the permanent action-version review policy. Historical warning lines remain in prior workflow logs; updated pinned actions have not yet been exercised in a new runner job, so absence of future warnings is not yet directly tested.

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

## Offline-first tool-host adapter

`src/tool-host.mjs` provides a portable `jev_evaluate_choice` tool declaration and one-call-capped handler for future approved connector hosts. It is **not deployed or registered as a ChatGPT plugin**; live requests stay disabled by default, and the model cannot supply authorization or credentials. Eight new targeted tests use mocked HTTP with no TypeSafe calls. See [tool-host interface, permission boundary and next gate](docs/JEV-TOOL-HOST.md).

## Integration plan

Use this standalone adapter in a separately authorized, reviewed consuming project. Keep `theey-base` production unchanged. Persist architecture decisions in the private `mind-self` repository, not sensitive state in the bridge.

Official reference: https://docs.typesafe.ai/sdk/javascript and https://docs.typesafe.ai/introduction/coding-agents
