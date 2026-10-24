import { createJevToolHandler, JEV_TOOL_DEFINITION, JEV_TOOL_NAME } from './tool-host.mjs';

// A stateless 2025-11-25 Streamable HTTP MCP surface; not an auth server or deployment.
// The host must verify OAuth access tokens and atomically reserve spend outside this module.
export const MCP_VERSION = '2025-11-25';
const MAX_BYTES = 16_384;
const TOOL_ARGS = new Set(['state', 'instructions', 'criteria']);
const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const unavailable = (reason) => ({ status: 'unavailable', reason, executionEffect: 'none' });
const notRun = (reason) => ({ status: 'not_run', reason, executionEffect: 'none' });
const toolContent = (out) => ({ content: [{ type: 'text', text: JSON.stringify(out) }], structuredContent: out, isError: false });
const rpc = (id, result) => ({ jsonrpc: '2.0', id, result });
const err = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
const json = (value, status = 200, extra = {}) => new Response(JSON.stringify(value), { status, headers: { ...headers, ...extra } });
const denied = () => new Response('', { status: 401, headers: { 'cache-control': 'no-store', 'www-authenticate': 'Bearer' } });

async function boundedJson(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  let bytes = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) return null;
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const part of chunks) { buffer.set(part, offset); offset += part.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer)); }
  catch { return null; }
}

function validArguments(args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return false;
  const keys = Object.keys(args);
  if (keys.length !== 3 || keys.some(key => !TOOL_ARGS.has(key))) return false;
  const { state, instructions, criteria } = args;
  if ((typeof state !== 'string' && (!state || typeof state !== 'object' || Array.isArray(state))) ||
    typeof instructions !== 'string' || !instructions.trim() || instructions.length > 320 ||
    !criteria || typeof criteria !== 'object' || Array.isArray(criteria)) return false;
  let serialized;
  try { serialized = JSON.stringify(state); } catch { return false; }
  if (!serialized || serialized.length < 3 || serialized.length > 4000) return false;
  const options = Object.entries(criteria);
  return options.length >= 2 && options.length <= 8 && options.every(([key, value]) =>
    /^[a-z][a-z0-9_-]{0,31}$/.test(key) && typeof value === 'string' &&
    !!value.trim() && value.length <= 160);
}

/**
 * authenticate(request) => {subject: string, scopes: ['jev:advisory']} after actual token validation.
 * approveData({subject, arguments}) => true only for synthetic/pre-approved data.
 * reserveCall({subject}) => true only after an ATOMIC durable, cost-capped reservation.
 * None of these permissions are ever sourced from the model's tool arguments.
 */
export function createPrivateMcpHandler({ authenticate, approveData, reserveCall,
  liveEnabled = false, apiKey, fetchImpl, allowedOrigins = [] } = {}) {
  const origins = new Set(allowedOrigins);
  return async function handle(request) {
    let pathname;
    try { pathname = new URL(request.url).pathname; } catch { return new Response('', { status: 400 }); }
    if (pathname !== '/mcp') return new Response('', { status: 404 });
    const origin = request.headers.get('origin');
    if (origin && !origins.has(origin)) return new Response('', { status: 403 });
    if (request.method !== 'POST') return new Response('', {
      status: 405, headers: { allow: 'POST', 'cache-control': 'no-store' },
    });
    let principal;
    try { principal = typeof authenticate === 'function' ? await authenticate(request) : null; }
    catch { principal = null; }
    if (!principal || typeof principal.subject !== 'string' || !principal.subject.trim() ||
      !Array.isArray(principal.scopes) || !principal.scopes.includes('jev:advisory')) return denied();
    if (request.headers.get('mcp-protocol-version') &&
      request.headers.get('mcp-protocol-version') !== MCP_VERSION) {
      return json(err(null, -32600, 'Unsupported protocol version'), 400);
    }
    let message;
    try { message = await boundedJson(request); } catch { return json(err(null, -32700, 'Invalid JSON'), 400); }
    if (!message || typeof message !== 'object' || Array.isArray(message) ||
      message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
      return json(err(null, -32600, 'Invalid request'), 400);
    }
    if (message.method === 'notifications/initialized' && !Object.hasOwn(message, 'id')) {
      return new Response(null, { status: 202, headers: { 'cache-control': 'no-store' } });
    }
    if (!Object.hasOwn(message, 'id') ||
      !(typeof message.id === 'string' || (typeof message.id === 'number' && Number.isFinite(message.id)))) {
      return json(err(null, -32600, 'Invalid request'), 400);
    }
    if (message.method === 'initialize') {
      if (!message.params || typeof message.params !== 'object' ||
        message.params.protocolVersion !== MCP_VERSION) return json(err(message.id, -32602, 'Unsupported initialize'), 400);
      return json(rpc(message.id, { protocolVersion: MCP_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'jev-bridge', version: '0.1.0' } }));
    }
    if (message.method === 'ping') return json(rpc(message.id, {}));
    if (message.method === 'tools/list') return json(rpc(message.id, {
      tools: [{ ...JEV_TOOL_DEFINITION, annotations: {
        title: 'JEV advisory choice', readOnlyHint: true, destructiveHint: false,
        idempotentHint: false, openWorldHint: true,
      } }],
    }));
    if (message.method !== 'tools/call') return json(err(message.id, -32601, 'Method not found'), 404);
    const name = message.params?.name;
    const args = message.params?.arguments;
    if (name !== JEV_TOOL_NAME || !validArguments(args)) {
      return json(rpc(message.id, toolContent(unavailable('invalid_tool_arguments'))));
    }
    if (!liveEnabled || typeof apiKey !== 'string' || !apiKey.trim()) {
      return json(rpc(message.id, toolContent(notRun('live_call_not_authorized'))));
    }
    let approved = false;
    try { approved = typeof approveData === 'function' &&
      (await approveData({ subject: principal.subject, arguments: args })) === true; }
    catch { /* fail closed */ }
    if (!approved) return json(rpc(message.id, toolContent(notRun('data_not_authorized'))));
    let reserved = false;
    try { reserved = typeof reserveCall === 'function' &&
      (await reserveCall({ subject: principal.subject })) === true; }
    catch { /* fail closed */ }
    if (!reserved) return json(rpc(message.id, toolContent(notRun('call_budget_not_authorized'))));
    const oneCall = createJevToolHandler({ allowOneLiveCall: true, apiKey,
      ...(fetchImpl ? { fetchImpl } : {}) });
    const outcome = await oneCall({ name, arguments: args });
    return json(rpc(message.id, outcome));
  };
}
