# Portable JEV tool-host adapter (offline-first)

Status: implemented and locally tested on 2026-10-24 PHT, **not deployed, registered or connected to ChatGPT**. This is a JavaScript tool-host contract for later separately authorized integration, not a network-facing MCP server, plugin, or production service.

## Interface

`src/tool-host.mjs` exports `JEV_TOOL_NAME`, `JEV_TOOL_DEFINITION`, and `createJevToolHandler`. The declared tool is `jev_evaluate_choice`; the model-controlled arguments are exactly `state`, `instructions` and `criteria`. There is no tool argument for TypeSafe API credentials, authorization, endpoints, action execution or additional billing.

The handler returns both `structuredContent` and a JSON text `content` entry. Its only substantive result is a non-executing advisory (`choice`, `confidence`, `probabilities`, `model`) or a sanitized `not_run` / `unavailable` result. Every result has `executionEffect: "none"`. It never exposes raw upstream payloads, request state, private errors or credentials in returned output.

## Host-side permission boundary

```js
import { JEV_TOOL_DEFINITION, createJevToolHandler } from './src/tool-host.mjs';

// Safe default. Even a model call with valid arguments makes zero requests.
const offline = createJevToolHandler();
const notRun = await offline({ name: JEV_TOOL_DEFINITION.name,
  arguments: { state: { task: 'example' }, instructions: 'Which is best?',
    criteria: { hold: 'Wait', review: 'Review first' } } });

// Only a trusted application, AFTER explicit owner, data and cost authorization,
// may construct a distinct one-call handler; never expose this configuration
// as model-callable arguments.
const approvedOnce = createJevToolHandler({
  allowOneLiveCall: true,
  apiKey: process.env.TYPESAFE_API_KEY,
});
// The consuming host, not JEV, must enforce identity, approvals and allowed data.
```

The one-call live budget is consumed **before** invoking the bridge, including if validation/network fails. Reusing the same handler cannot retry or issue a second call. The existing `evaluateChoice` bounds still apply (max 4,000 serialized state characters, 2-8 short option labels, 8-second timeout, pinned TypeSafe endpoint, no execution authority). A host must not reconstruct live handlers automatically per model turn or accept a model request as owner approval. Neither this module nor its tests execute a live TypeSafe call without an authorized host creating the live handler.

## Evidence and next decision

- Offline Node.js 22.16.0: `node --test test/tool-host.test.mjs` passed **8/8** on 2026-10-24 PHT using synthetic, mocked responses. No GitHub Actions or TypeSafe usage. The complete pre-existing repository suite was **not rerun** for this change at this checkpoint.
- Repository action pins and manual-only benchmark remain unchanged; the prior 15-call benchmark is recorded in [JEV-BENCHMARK.md](JEV-BENCHMARK.md).
- **Next decision gate:** choose whether to expose this through a privately authenticated service/plugin, specify hosting, auth, secret storage, requester approval, rate limits, cost ceiling and data scope. Do not deploy, enable automatic traffic, connect customer systems or grant tool execution authority implicitly. Additional paid benchmarking remains separately authorized.
