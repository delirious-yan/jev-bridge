import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateMcpHandler, MCP_VERSION } from '../src/private-mcp.mjs';

const args = { state: { task: 'synthetic tab navigation' }, instructions: 'Which tab action?',
  criteria: { previous: 'Previous tab', nothing: 'No action' } };
const message = (method, params, id = 3) => ({ jsonrpc: '2.0', id, method, params });
const req = (body, headers = {}, method = 'POST') => new Request('https://example.test/mcp', {
  method, headers: { 'content-type': 'application/json', ...headers },
  ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
});
const auth = async () => ({ subject: 'owner-test', scopes: ['jev:advisory'] });
const approved = { authenticate: auth, approveData: async () => true, reserveCall: async () => true, liveEnabled: true, apiKey: 'FAKE' };
const mockFetch = async () => ({ ok: true, json: async () => ({ model: 'jev-1.14.0', answers: {
  verdict: { type: 'choice', choice: 'previous', confidence: 0.95,
    probabilities: { previous: 0.95, nothing: 0.05 } },
} }) });

async function invoke(handle, body, headers) { const res = await handle(req(body, headers));
  return { status: res.status, headers: res.headers, data: [202, 401, 403, 405].includes(res.status) ? null : await res.json() }; }

test('missing trusted authentication rejects even initialize', async () => {
  const handle = createPrivateMcpHandler();
  const res = await handle(req(message('initialize', { protocolVersion: MCP_VERSION })));
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('www-authenticate'), 'Bearer');
});

test('signed principal must carry the advisory scope', async () => {
  const handle = createPrivateMcpHandler({ authenticate: async () => ({ subject: 'x', scopes: ['other'] }) });
  assert.equal((await invoke(handle, message('tools/list'))).status, 401);
});

test('initialization and discovery require auth but spend no credits', async () => {
  let count = 0;
  const h = createPrivateMcpHandler({ authenticate: auth, reserveCall: async () => { count++; return true; } });
  const i = await invoke(h, message('initialize', { protocolVersion: MCP_VERSION }));
  assert.equal(i.data.result.protocolVersion, MCP_VERSION);
  const l = await invoke(h, message('tools/list'));
  assert.equal(l.data.result.tools.length, 1);
  assert.equal(l.data.result.tools[0].name, 'jev_evaluate_choice');
  assert.equal(l.data.result.tools[0].annotations.readOnlyHint, true);
  assert.equal(count, 0);
});

test('authorized tools/call remains offline by default', async () => {
  let fetches = 0;
  const h = createPrivateMcpHandler({ authenticate: auth, fetchImpl: () => { fetches++; throw Error('leak'); } });
  const r = await invoke(h, message('tools/call', { name: 'jev_evaluate_choice', arguments: args }));
  assert.equal(r.data.result.structuredContent.reason, 'live_call_not_authorized');
  assert.equal(fetches, 0);
});

test('live requires trusted data approval and durable reservation', async () => {
  let calls = 0;
  const h = createPrivateMcpHandler({ authenticate: auth, liveEnabled: true, apiKey: 'FAKE',
    approveData: async () => false, reserveCall: async () => { calls++; return true; }, fetchImpl: mockFetch });
  const r = await invoke(h, message('tools/call', { name: 'jev_evaluate_choice', arguments: args }));
  assert.equal(r.data.result.structuredContent.reason, 'data_not_authorized');
  assert.equal(calls, 0);
});

test('missing reservation or failed reservation never invokes TypeSafe', async () => {
  let n = 0;
  const h = createPrivateMcpHandler({ authenticate: auth, approveData: async () => true,
    liveEnabled: true, apiKey: 'FAKE', reserveCall: async () => { throw Error('internal-only'); },
    fetchImpl: async () => { n++; return mockFetch(); } });
  const r = await invoke(h, message('tools/call', { name: 'jev_evaluate_choice', arguments: args }));
  assert.equal(r.data.result.structuredContent.reason, 'call_budget_not_authorized');
  assert.equal(JSON.stringify(r.data).includes('internal-only'), false);
  assert.equal(n, 0);
});

test('approved budget triggers exactly one mocked JEV request', async () => {
  let n = 0, reserves = 0;
  const h = createPrivateMcpHandler({ ...approved, reserveCall: async () => { reserves++; return true; },
    fetchImpl: async () => { n++; return mockFetch(); } });
  const r = await invoke(h, message('tools/call', { name: 'jev_evaluate_choice', arguments: args }));
  assert.equal(r.data.result.structuredContent.status, 'advisory');
  assert.equal(r.data.result.structuredContent.executionEffect, 'none');
  assert.equal(n, 1);
  assert.equal(reserves, 1);
});

test('model-supplied auth overrides and malformed args cannot reserve a call', async () => {
  let reserves = 0;
  const h = createPrivateMcpHandler({ ...approved, reserveCall: async () => { reserves++; return true; }, fetchImpl: mockFetch });
  for (const bad of [{ ...args, allowNetwork: true }, { ...args, apiKey: 'TRICK' }, { ...args, state: 'x'.repeat(5000) }]) {
    const r = await invoke(h, message('tools/call', { name: 'jev_evaluate_choice', arguments: bad }));
    assert.equal(r.data.result.structuredContent.reason, 'invalid_tool_arguments');
  }
  assert.equal(reserves, 0);
});

test('origin enforcement and HTTP method restrictions', async () => {
  const h = createPrivateMcpHandler({ authenticate: auth, allowedOrigins: ['https://trusted.test'] });
  assert.equal((await h(req(message('tools/list'), { Origin: 'https://evil.test' }))).status, 403);
  assert.equal((await h(req(message('tools/list'), {}, 'GET'))).status, 405);
  assert.equal((await h(req(message('tools/list'), { Origin: 'https://trusted.test' }))).status, 200);
});

test('oversize requests and unsupported versions fail without budget reservation', async () => {
  let reserves = 0;
  const h = createPrivateMcpHandler({ ...approved, reserveCall: async () => { reserves++; return true; } });
  const big = message('tools/call', { name: 'jev_evaluate_choice', arguments: { ...args, payload: 'x'.repeat(17_000) } });
  assert.equal((await invoke(h, big)).status, 400);
  assert.equal((await invoke(h, message('tools/list'), { 'MCP-Protocol-Version': '2024-11-05' })).status, 400);
  assert.equal(reserves, 0);
});

test('notifications and unsupported methods have protocol responses', async () => {
  const h = createPrivateMcpHandler({ authenticate: auth });
  const notification = await h(req({ jsonrpc: '2.0', method: 'notifications/initialized' }));
  assert.equal(notification.status, 202);
  const noTool = await invoke(h, message('resources/list'));
  assert.equal(noTool.data.error.code, -32601);
});
