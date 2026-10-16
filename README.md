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

**Neither workflow has been dispatched.** The private account's included GitHub-hosted minutes were exhausted earlier in October 2026 (per owner policy), so do not run hosted Actions unless capacity/cost is separately confirmed. Never redirect this job to the owner's Windows runner.

## Integration plan

Use this standalone adapter in a separately authorized, reviewed consuming project. Keep `theey-base` production unchanged. Persist architecture decisions in the private `mind-self` repository, not sensitive state in the bridge.

Official reference: https://docs.typesafe.ai/sdk/javascript and https://docs.typesafe.ai/introduction/coding-agents
