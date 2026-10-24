# JEV private MCP integration: source-only candidate

Status, 2026-10-24 PHT: NOT deployed, connected to ChatGPT, attached to an OAuth issuer, or granted live TypeSafe access. This source is not a finished private plugin.

## Implemented

- src/mcp-http.mjs provides a stateless Streamable HTTP JSON-response subset of MCP 2025-11-25. Supports initialize, notifications/initialized, ping, tools/list and tools/call. GET /mcp is intentionally not supported; 2026-07-28 handshake-free protocol, server-sent streams and subscriptions are not implemented.
- src/mcp-host.mjs binds the pre-existing jev_evaluate_choice advisory tool. The tool metadata declares an OAuth security scheme and jev:evaluate scope.
- Tool calls reject unexpected browser origins, unsupported protocol versions, invalid JSON, large bodies (16 KiB limit), missing bearer tokens and scope-less identities. Handler responses are reconstructed from safe fields, not passed through with potentially private extras.
- Authorization is DENIED BY DEFAULT. No built-in calls, credentials, deploy step, user database, OAuth provider, or funding are added.

## Critical deployment requirements

1. Supply a real OAuth 2.1 authorization server supporting authorization code + PKCE S256, discovery metadata, appropriate client registration and issuer verification. Configure the MCP protected resource HTTPS URL. A web browser or model never chooses its own identity.
2. Inject verifyAccessToken(token) on the trusted server. It must validate OAuth access tokens (issuer, audience/resource, signature/introspection, expiry, revocation, exact requested scope), and return a verified subject and scopes. The default callback always denies.
3. Inject consumeApprovedCall({subject}) using an ATOMIC, durable, expiring and owner-approved call reservation ledger. Its default callback always denies. A valid OAuth login alone cannot authorize live JEV spending. An in-memory or per-request counter is insufficient on multiple workers.
4. Keep the TypeSafe API key in server secret storage, never in GitHub source or tool arguments. Impose a budget, rate limit, synthetic-data-only scope, allowed identities and explicit call approval before enabling any live invocation.
5. Host behind trusted HTTPS and verify exact ChatGPT MCP discovery, OAuth linking and actual tool invocation before making installation claims.

## Offline evidence

Six committed unit tests (test/mcp-smoke.test.mjs) passed using local Node 22.16.0 and mock identity/grant callbacks. An expanded local security probe also passed 13/13. No JEV or GitHub Actions calls were made for this test. These are unit tests, not proof of OAuth, transport interoperability, multihost grant atomicity, billing safety, or production readiness.

Next decision gate: choose the real hosting platform, OAuth provider and durable approval store; authorize a separately bounded integration test. Do not deploy a dummy or unauthenticated public MCP endpoint.

References: https://developers.openai.com/plugins/build/auth ; https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt ; https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
