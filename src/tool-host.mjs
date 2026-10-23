import { evaluateChoice } from './jev.mjs';

export const JEV_TOOL_NAME = 'jev_evaluate_choice';

// A portable, tool-host-shaped declaration; registration and authentication belong to the host.
// Credentials and authorization are intentionally absent from tool-call arguments.
export const JEV_TOOL_DEFINITION = Object.freeze({
  name: JEV_TOOL_NAME,
  description: 'Return a read-only JEV advisory for one bounded choice; never execute the choice. Requires host-side live authorization.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['state', 'instructions', 'criteria'],
    properties: {
      state: { oneOf: [{ type: 'string' }, { type: 'object' }] },
      instructions: { type: 'string', minLength: 1, maxLength: 320 },
      criteria: { type: 'object', minProperties: 2, maxProperties: 8,
        additionalProperties: { type: 'string', minLength: 1, maxLength: 160 } },
    },
  },
});

const ARGUMENTS = new Set(['state', 'instructions', 'criteria']);
const SAFE_REASONS = new Set([
  'missing_api_key', 'missing_fetch', 'upstream_http_error',
  'invalid_upstream_response', 'request_failed',
]);
const unavailable = (reason) => ({ status: 'unavailable', reason, executionEffect: 'none' });
const notRun = () => ({ status: 'not_run', reason: 'live_call_not_authorized', executionEffect: 'none' });
const toolResponse = (result) => ({
  content: [{ type: 'text', text: JSON.stringify(result) }],
  structuredContent: result,
  isError: false,
});

function safeResult(result, criteria) {
  if (result?.status === 'unavailable') {
    return unavailable(SAFE_REASONS.has(result.reason) ? result.reason : 'invalid_evaluator_response');
  }
  if (result?.status !== 'advisory' || typeof result.choice !== 'string' ||
      !Object.hasOwn(criteria, result.choice) ||
      typeof result.confidence !== 'number' || !Number.isFinite(result.confidence) ||
      result.confidence < 0 || result.confidence > 1 ||
      typeof result.model !== 'string' || !/^jev[-a-z0-9.]{1,50}$/.test(result.model)) {
    return unavailable('invalid_evaluator_response');
  }
  const probabilities = {};
  for (const key of Object.keys(criteria)) {
    const value = result.probabilities?.[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      return unavailable('invalid_evaluator_response');
    }
    probabilities[key] = value;
  }
  return { status: 'advisory', choice: result.choice, confidence: result.confidence,
    probabilities, model: result.model, executionEffect: 'none' };
}

// The trusted host may construct one explicitly authorized instance per approved call.
// Live permission is a constructor-only capability, never an instruction from the model.
// Even with approval, the instance spends its one-call budget BEFORE attempting the request.
export function createJevToolHandler({ allowOneLiveCall = false, apiKey, fetchImpl,
  evaluator = evaluateChoice } = {}) {
  let remaining = allowOneLiveCall === true ? 1 : 0;
  return async function handleToolCall({ name, arguments: args } = {}) {
    if (name !== JEV_TOOL_NAME || !args || typeof args !== 'object' || Array.isArray(args) ||
        Object.keys(args).length !== ARGUMENTS.size ||
        Object.keys(args).some((key) => !ARGUMENTS.has(key)) ||
        [...ARGUMENTS].some((key) => !Object.hasOwn(args, key))) {
      return toolResponse(unavailable('invalid_tool_arguments'));
    }
    if (remaining === 0) return toolResponse(notRun());
    remaining = 0;
    try {
      const result = await evaluator({ state: args.state, instructions: args.instructions,
        criteria: args.criteria, apiKey, allowNetwork: true, timeoutMs: 8000,
        ...(fetchImpl ? { fetchImpl } : {}) });
      return toolResponse(safeResult(result, args.criteria));
    } catch {
      return toolResponse(unavailable('invalid_tool_arguments'));
    }
  };
}
