// Stateless MCP 2025-11-25 Streamable HTTP JSON response subset, offline-first.
export const MCP_VERSION = '2025-11-25';
const jsonHeaders = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const payload = (value, status = 200, headers = {}) =>
  new Response(JSON.stringify(value), { status, headers: { ...jsonHeaders, ...headers } });
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
const invalid = (reason) => ({ status: 'unavailable', reason, executionEffect: 'none' });
const noApproval = { status: 'not_run', reason: 'live_call_not_authorized', executionEffect: 'none' };
const toolResult = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value, isError: false });
const validId = (id) => typeof id === 'string' || (typeof id === 'number' && Number.isSafeInteger(id));
const validPrincipal = (p) => p && typeof p === 'object' && typeof p.subject === 'string' && p.subject.length > 0 && p.subject.length <= 256 && Array.isArray(p.scopes) && p.scopes.includes('jev:evaluate');
const MAX_BODY = 16_384;

// Never pass arbitrary evaluator payloads, logs, errors, or credentials back to a model.
function sanitizeAnswer(answer, criteria) {
  const r = answer?.structuredContent;
  if (r?.status === 'not_run') return noApproval;
  if (r?.status === 'unavailable') {
    const allowed = new Set(['invalid_tool_arguments', 'missing_api_key', 'missing_fetch', 'upstream_http_error', 'invalid_upstream_response', 'request_failed', 'invalid_evaluator_response']);
    return invalid(allowed.has(r.reason) ? r.reason : 'invalid_handler_response');
  }
  if (r?.status === 'advisory' && criteria && typeof criteria === 'object' &&
      !Array.isArray(criteria) && Object.hasOwn(criteria, r.choice) &&
      typeof r.confidence === 'number' && Number.isFinite(r.confidence) && r.confidence >= 0 && r.confidence <= 1 &&
      typeof r.model === 'string' && /^jev[-a-z0-9.]{1,50}$/.test(r.model)) {
    const probabilities = {};
    for (const key of Object.keys(criteria)) {
      const n = r.probabilities?.[key];
      if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1) return invalid('invalid_handler_response');
      probabilities[key] = n;
    }
    return { status: 'advisory', choice: r.choice, confidence: r.confidence, probabilities, model: r.model, executionEffect: 'none' };
  }
  return invalid('invalid_handler_response');
}

async function readSmallBody(request) {
  if (Number(request.headers.get('content-length')) > MAX_BODY) throw Error('payload_too_large');
  const reader = request.body?.getReader();
  if (!reader) throw Error('missing_body');
  let bytes = 0;
  const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY) { await reader.cancel(); throw Error('payload_too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(joined));
}

export function createMcpHttpHandler({
  toolDefinition, makeToolHandler, verifyAccessToken = async () => null,
  consumeApprovedCall = async () => false, allowedOrigins = [], resourceUrl, authorizationServer,
} = {}) {
  if (!toolDefinition || typeof toolDefinition.name !== 'string' || !toolDefinition.inputSchema ||
      typeof makeToolHandler !== 'function' || typeof verifyAccessToken !== 'function' ||
      typeof consumeApprovedCall !== 'function' || !Array.isArray(allowedOrigins)) {
    throw new TypeError('MCP host must supply a tool definition, handler factory, and authorization hooks');
  }
  if ((resourceUrl || authorizationServer) &&
      !(typeof resourceUrl === 'string' && /^https:\/\//.test(resourceUrl) &&
        typeof authorizationServer === 'string' && /^https:\/\//.test(authorizationServer))) {
    throw new TypeError('OAuth resource metadata needs trusted HTTPS resource and issuer URLs');
  }
  const metadataPath = '/.well-known/oauth-protected-resource';
  const challenge = resourceUrl ? 'Bearer resource_metadata="' + new URL(metadataPath, resourceUrl).href + '"' : 'Bearer';
  return async function mcpFetch(request) {
    const url = new URL(request.url);
    if (request.headers.has('origin') && !allowedOrigins.includes(request.headers.get('origin')))
      return payload({ error: 'origin_not_allowed' }, 403);
    if (url.pathname === metadataPath && request.method === 'GET' && resourceUrl)
      return payload({ resource: resourceUrl, authorization_servers: [authorizationServer], scopes_supported: ['jev:evaluate'] });
    if (url.pathname !== '/mcp') return payload({ error: 'not_found' }, 404);
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST', 'cache-control': 'no-store' } });
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return payload({ error: 'unsupported_media_type' }, 415);
    const accepts = request.headers.get('accept') || '';
    if (!accepts.includes('application/json') || !accepts.includes('text/event-stream')) return payload({ error: 'invalid_accept' }, 406);
    const versionHeader = request.headers.get('mcp-protocol-version');
    if (versionHeader && versionHeader !== MCP_VERSION) return payload(rpcError(null, -32600, 'Unsupported MCP protocol version'), 400);
    let rpc;
    try { rpc = await readSmallBody(request); }
    catch { return payload(rpcError(null, -32700, 'Invalid or oversized JSON request'), 400); }
    if (!rpc || typeof rpc !== 'object' || Array.isArray(rpc) || rpc.jsonrpc !== '2.0' ||
        typeof rpc.method !== 'string' || (Object.hasOwn(rpc, 'id') && !validId(rpc.id)))
      return payload(rpcError(null, -32600, 'Invalid JSON-RPC request'), 400);
    if (!Object.hasOwn(rpc, 'id')) {
      return rpc.method === 'notifications/initialized'
        ? new Response(null, { status: 202, headers: { 'cache-control': 'no-store' } })
        : payload(rpcError(null, -32600, 'Unsupported notification'), 400);
    }
    const id = rpc.id;
    if (rpc.method === 'initialize') {
      return payload(rpcResult(id, { protocolVersion: MCP_VERSION, capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'jev-bridge', version: '0.1.0' },
        instructions: 'Read-only JEV advisory. Host-approved call only; no execution authority.' }));
    }
    if (rpc.method === 'ping') return payload(rpcResult(id, {}));
    if (rpc.method === 'tools/list') {
      return payload(rpcResult(id, { tools: [{ ...toolDefinition,
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
        securitySchemes: [{ type: 'oauth2', scopes: ['jev:evaluate'] }],
      }] }));
    }
    if (rpc.method !== 'tools/call') return payload(rpcError(id, -32601, 'Method not found'));
    if (!rpc.params || typeof rpc.params !== 'object' || Array.isArray(rpc.params) ||
        rpc.params.name !== toolDefinition.name || !Object.hasOwn(rpc.params, 'arguments'))
      return payload(rpcResult(id, toolResult(invalid('invalid_tool_arguments'))));
    const match = /^Bearer ([A-Za-z0-9._~+\/-]+=*)$/i.exec(request.headers.get('authorization') || '');
    if (!match) return payload({ error: 'authentication_required' }, 401,
      { 'www-authenticate': challenge });
    let principal;
    try { principal = await verifyAccessToken(match[1]); } catch { principal = null; }
    if (!validPrincipal(principal)) return payload({ error: 'authentication_required' }, 401,
      { 'www-authenticate': challenge });
    // The model cannot grant itself authorization: a trusted durable controller must
    // atomically consume a separately owner-approved, pre-funded grant.
    let approved = false;
    try { approved = (await consumeApprovedCall({ subject: principal.subject })) === true; }
    catch { approved = false; }
    if (!approved) return payload(rpcResult(id, toolResult(noApproval)));
    try {
      const handler = makeToolHandler({ allowOneLiveCall: true });
      const answer = await handler({ name: rpc.params.name, arguments: rpc.params.arguments });
      return payload(rpcResult(id, toolResult(sanitizeAnswer(answer, rpc.params.arguments?.criteria))));
    } catch {
      return payload(rpcResult(id, toolResult(invalid('request_failed'))));
    }
  };
}
