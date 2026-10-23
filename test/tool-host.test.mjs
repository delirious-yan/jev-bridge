import test from 'node:test';
import assert from 'node:assert/strict';
import { createJevToolHandler, JEV_TOOL_DEFINITION, JEV_TOOL_NAME } from '../src/tool-host.mjs';

const args = { state: { requestedAction: 'Open the previous tab' },
  instructions: 'Which tab action is requested?',
  criteria: { previous: 'Existing previous tab', no_match: 'Neither action' } };
const call = { name: JEV_TOOL_NAME, arguments: args };

const response = () => ({ ok: true, async json() {
  return { model: 'jev-1.14.0', answers: { verdict: { type: 'choice',
    choice: 'previous', confidence: 0.95,
    probabilities: { previous: 0.95, no_match: 0.05 } } } };
} });

test('tool declaration exposes no credentials, network override or execution authority', () => {
  assert.equal(JEV_TOOL_DEFINITION.name, JEV_TOOL_NAME);
  assert.deepEqual(Object.keys(JEV_TOOL_DEFINITION.inputSchema.properties), ['state', 'instructions', 'criteria']);
  assert.equal(JEV_TOOL_DEFINITION.inputSchema.additionalProperties, false);
});

test('default host is offline and cannot be activated by tool arguments', async () => {
  let calls = 0;
  const handle = createJevToolHandler({ apiKey: 'synthetic',
    fetchImpl: () => { calls++; throw Error('unexpected egress'); } });
  const result = await handle(call);
  assert.deepEqual(result.structuredContent, { status: 'not_run',
    reason: 'live_call_not_authorized', executionEffect: 'none' });
  assert.equal(calls, 0);
});

test('model cannot smuggle live authorization or credentials through arguments', async () => {
  let calls = 0;
  const handle = createJevToolHandler({ allowOneLiveCall: true, apiKey: 'synthetic',
    fetchImpl: () => { calls++; return response(); } });
  for (const extra of [{ allowNetwork: true }, { apiKey: 'override' }, { allowOneLiveCall: true }]) {
    const result = await handle({ name: JEV_TOOL_NAME, arguments: { ...args, ...extra } });
    assert.equal(result.structuredContent.reason, 'invalid_tool_arguments');
  }
  assert.equal(calls, 0);
  const result = await handle(call);
  assert.equal(result.structuredContent.status, 'advisory');
  assert.equal(calls, 1);
});

test('approved instance makes at most one request, returning only a nonexecuting advisory', async () => {
  let calls = 0;
  const handle = createJevToolHandler({ allowOneLiveCall: true, apiKey: 'synthetic',
    fetchImpl: () => { calls++; return response(); } });
  const first = await handle(call);
  assert.deepEqual(first.structuredContent, { status: 'advisory', choice: 'previous',
    confidence: 0.95, probabilities: { previous: 0.95, no_match: 0.05 },
    model: 'jev-1.14.0', executionEffect: 'none' });
  assert.deepEqual(JSON.parse(first.content[0].text), first.structuredContent);
  const second = await handle(call);
  assert.equal(second.structuredContent.status, 'not_run');
  assert.equal(calls, 1);
});

test('failed one-call attempt does not retry or leak exception text', async () => {
  let calls = 0;
  const handle = createJevToolHandler({ allowOneLiveCall: true, apiKey: 'synthetic',
    fetchImpl: () => { calls++; throw Error('PRIVATE_UPSTREAM_BODY'); } });
  const first = await handle(call);
  assert.equal(first.structuredContent.status, 'unavailable');
  assert.equal(first.structuredContent.reason, 'request_failed');
  assert.ok(!JSON.stringify(first).includes('PRIVATE_UPSTREAM_BODY'));
  assert.equal((await handle(call)).structuredContent.status, 'not_run');
  assert.equal(calls, 1);
});

test('invalid input is rejected before any network transmission, and consumes approval', async () => {
  let calls = 0;
  const handle = createJevToolHandler({ allowOneLiveCall: true, apiKey: 'synthetic',
    fetchImpl: () => { calls++; throw Error('unexpected egress'); } });
  const invalid = await handle({ name: JEV_TOOL_NAME, arguments: { ...args, state: 'x'.repeat(5000) } });
  assert.equal(invalid.structuredContent.reason, 'invalid_tool_arguments');
  assert.equal((await handle(call)).structuredContent.status, 'not_run');
  assert.equal(calls, 0);
});

test('unknown tool names fail closed without using the live budget', async () => {
  const handle = createJevToolHandler({ allowOneLiveCall: true, apiKey: 'synthetic',
    fetchImpl: async () => response() });
  assert.equal((await handle({ ...call, name: 'execute_command' })).structuredContent.reason, 'invalid_tool_arguments');
  assert.equal((await handle(call)).structuredContent.status, 'advisory');
});

test('invalid or untrusted evaluator outputs cannot inject private body or action', async () => {
  const handle = createJevToolHandler({ allowOneLiveCall: true, apiKey: 'synthetic',
    evaluator: async () => ({ status: 'advisory', choice: 'delete_all', confidence: 1,
      probabilities: {}, model: 'jev-1.14.0', executionEffect: 'delete_all', secret: 'PRIVATE' }) });
  const result = await handle(call);
  assert.equal(result.structuredContent.reason, 'invalid_evaluator_response');
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});
