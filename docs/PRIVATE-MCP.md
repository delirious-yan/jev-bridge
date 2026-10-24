# JEV private MCP prototype — integration boundary

Status: **protocol prototype, not deployed or ChatGPT-connected**. It implements a stateless JSON-RPC Streamable HTTP surface for MCP version 2025-11-25 using standard Fetch Request/Response APIs, with no third-party dependencies.

## Interface

The new module src/private-mcp.mjs exports createPrivateMcpHandler. Attach that function to a private HTTPS route /mcp only after trusted hosting and authentication are configured. It handles initialize, notifications/initialized, ping, tools/list and tools/call for exactly one advisory tool, jev_evaluate_choice. It rejects unexpected methods, invalid Origin values, unexpected tool arguments, oversized bodies (16 KiB), and unsupported protocol versions.

Each result remains non-executing. Discovery is also protected: without a validated principal carrying the jev:advisory scope, the host returns 401. There is no model-supplied access token, secret, endpoint or authorization parameter.

## Required production integrations (not implemented)

1. **OAuth 2.1 identity:** Provide a standards-compliant authorization server and protected-resource discovery metadata, consent and PKCE support, issuer/audience/scope/expiry verification on EVERY request, and a real authenticate(request) callback. Return { subject, scopes } only after verification. A static token check or unauthenticated public endpoint is not a production substitute. No OAuth provider or credentials are provisioned by this prototype.
2. **Data authority:** Implement approveData({ subject, arguments }) to authorize precisely which synthetic or otherwise separately consented data can be sent. Default denies every live call. Do not forward private repositories, customer tickets or account data automatically.
3. **Atomic cost control:** Implement reserveCall({ subject }) using a trusted durable, atomic per-user and global spend/call counter with explicit operator-set caps and no retries. This must be concurrency-safe across instances and restarts; an in-memory counter alone is NOT sufficient. Default denies every live call.
4. **Secret custody:** Keep the TypeSafe key entirely in a server-side secret manager; never ship it in the plugin archive or the user/model tool schema. liveEnabled must remain false until a separately authorized, capped paid-call test.
5. **HTTPS hosting:** Enforce TLS, appropriate allowedOrigins and no caching of responses. Apply connection rate limits and review authorization-server metadata. Do not set an automatic GitHub Actions deployment or import unrelated app credentials.

This module itself does not implement an OAuth authorization server, durable quota store, rate limiter, hosted Worker/MCP endpoint or ChatGPT plugin installation. Those are independent deployment gates. It should not be represented as a completed live connector. The handler alone is insufficient to ensure cost or identity safety unless the hosting callbacks really enforce the requirements above. Prefer OAuth-protected remote MCP over inventing bearer tokens in model arguments.

## Local validation

On 2026-10-24 PHT, the targeted suite node --test test/private-mcp.test.mjs passed 11/11 on Node 22.16.0. The requests used in-memory synthetic/mocked callbacks and mocked TypeSafe HTTP responses; no upstream traffic, paid JEV calls or GitHub Actions minutes. This is *not* an actual MCP client interoperability, OAuth integration, multi-instance reservation or deployment test.

Existing JEV benchmark results remain in docs/JEV-BENCHMARK.md; do not expand benchmark credits or assume production accuracy from five synthetic cases. The previous Node 24 GitHub Action runtime migration is unchanged.

## Next decision gate

After owner review, select a hosting environment and OAuth identity provider, define the explicit daily/monthly call and cost caps, and confirm account eligibility for private ChatGPT MCP plugins. Implement and test real OAuth token verification plus durable budget reservations before any deployment or plugin registration. Only then run a separately authorized one-call live connectivity check.
