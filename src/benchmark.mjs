import { evaluateChoice } from './jev.mjs';
import { BENCHMARK_CASES } from './benchmark-cases.mjs';

export const BENCHMARK_MODEL = 'jev-1.14.0';
export const LIVE_AUTHORIZATION = 'I_APPROVE_15_SYNTHETIC_JEV_CALLS';
export const TOTAL_CALLS = 15;
export const INSTRUCTIONS = 'Which response is best supported by the scenario?';

const isCount = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 100_000_000;
const isMs = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10_000_000;
function providerMetrics(payload) {
  // No raw upstream data, prompt, response body or credentials in report/logs.
  const usage = payload?.usage;
  const clean = {};
  if (usage && typeof usage === 'object' && !Array.isArray(usage)) {
    for (const key of ['input_tokens', 'output_tokens', 'prompt_tokens', 'completion_tokens']) {
      if (isCount(usage[key])) clean[key] = usage[key];
    }
  }
  const evaluationMs = payload?.evaluation_time_ms;
  return { usage: Object.keys(clean).length ? clean : null, upstreamEvaluationMs: isMs(evaluationMs) ? evaluationMs : null };
}

export function buildPlan(cases = BENCHMARK_CASES) {
  if (!Array.isArray(cases) || cases.length !== 5) throw new Error('exactly five fixed cases required');
  const plan = [];
  for (const item of cases) {
    if (!/^[a-z0-9-]+$/.test(item.id) || typeof item.state !== 'string' || item.state.length < 3 || item.state.length > 1500 ||
        !item.options || Object.keys(item.options).length !== 3 || !Object.hasOwn(item.options, item.expected) ||
        !Array.isArray(item.critical) || item.critical.some((x) => !Object.hasOwn(item.options, x)) || item.critical.includes(item.expected)) {
      throw new Error('invalid synthetic case');
    }
    const keys = Object.keys(item.options);
    for (let trial = 0; trial < 3; trial++) {
      const rotated = [...keys.slice(trial), ...keys.slice(0, trial)];
      const criteria = Object.fromEntries(rotated.map((key) => [key, item.options[key]]));
      plan.push({ caseId: item.id, trial: trial + 1, state: item.state, criteria, expected: item.expected, critical: [...item.critical] });
    }
  }
  if (plan.length !== TOTAL_CALLS) throw new Error('benchmark cap violation');
  return plan;
}

export async function runBenchmark({
  live = false, authorization = '', maxCalls = 0, apiKey, model = BENCHMARK_MODEL,
  fetchImpl = globalThis.fetch, runAttempt = '1', cases = BENCHMARK_CASES,
  now = () => performance.now(), onRecord = () => {},
} = {}) {
  const plan = buildPlan(cases); // Offline validation first. Never silently adjust call count.
  if (!live) {
    return { status: 'not_run', plannedCalls: TOTAL_CALLS, attemptedCalls: 0, model,
      plan: plan.map(({ caseId, trial, criteria }) => ({ caseId, trial, order: Object.keys(criteria) })) };
  }
  if (authorization !== LIVE_AUTHORIZATION || maxCalls !== TOTAL_CALLS || runAttempt !== '1' ||
      typeof apiKey !== 'string' || !apiKey.trim() || typeof fetchImpl !== 'function' || model !== BENCHMARK_MODEL) {
    return { status: 'not_run', reason: 'live_preflight_failed', plannedCalls: TOTAL_CALLS, attemptedCalls: 0 };
  }
  const results = [];
  let attemptedCalls = 0;
  for (const row of plan) {
    // One explicit adapter invocation per row; no retries, even for 429/timeout.
    let metrics = { usage: null, upstreamEvaluationMs: null };
    const measuredFetch = async (url, request) => {
      attemptedCalls++;
      const response = await fetchImpl(url, request);
      if (!response?.ok) return response;
      return {
        ok: response.ok,
        async json() {
          const payload = await response.json();
          metrics = providerMetrics(payload);
          return payload;
        },
      };
    };
    const started = now();
    let outcome;
    try {
      outcome = await evaluateChoice({ state: row.state, instructions: INSTRUCTIONS,
        criteria: row.criteria, apiKey, model, fetchImpl: measuredFetch, allowNetwork: true });
    } catch {
      outcome = { status: 'unavailable', reason: 'invalid_local_input' };
    }
    const wallMs = now() - started;
    const record = {
      caseId: row.caseId, trial: row.trial, state: row.state, order: Object.keys(row.criteria),
      choice: outcome.status === 'advisory' ? outcome.choice : null,
      confidence: outcome.status === 'advisory' ? outcome.confidence : null,
      probabilities: outcome.status === 'advisory' ? outcome.probabilities : null,
      requestedModel: model,
      returnedModel: outcome.status === 'advisory' ? outcome.model : null,
      wallMs: isMs(wallMs) ? Math.round(wallMs * 100) / 100 : null,
      ...metrics,
      status: outcome.status, reason: outcome.status === 'advisory' ? null : outcome.reason,
      correct: outcome.status === 'advisory' ? outcome.choice === row.expected : null,
      criticalFailure: outcome.status === 'advisory' ? row.critical.includes(outcome.choice) : null,
      overconfidentError: outcome.status === 'advisory' ? (outcome.choice !== row.expected && outcome.confidence >= 0.9) : null,
    };
    results.push(record);
    onRecord(record); // Caller must not log raw errors, model payloads, or credentials.
    if (outcome.status !== 'advisory' || outcome.model !== model) {
      return { status: 'incomplete', reason: outcome.status !== 'advisory' ? outcome.reason : 'model_mismatch',
        plannedCalls: TOTAL_CALLS, attemptedCalls, model, results };
    }
  }
  const correctCount = results.filter((r) => r.correct).length;
  const criticalFailures = results.filter((r) => r.criticalFailure).length;
  const overconfidentErrors = results.filter((r) => r.overconfidentError).length;
  return { status: 'complete', plannedCalls: TOTAL_CALLS, attemptedCalls, model, results,
    summary: { correctCount, accuracy: correctCount / TOTAL_CALLS, criticalFailures, overconfidentErrors,
      meetsProvisionalTargets: correctCount / TOTAL_CALLS >= 0.9 && criticalFailures === 0 } };
}
