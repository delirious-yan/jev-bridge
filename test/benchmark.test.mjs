import test from 'node:test';
import assert from 'node:assert/strict';
import { BENCHMARK_CASES } from '../src/benchmark-cases.mjs';
import { buildPlan, runBenchmark, LIVE_AUTHORIZATION, TOTAL_CALLS, BENCHMARK_MODEL } from '../src/benchmark.mjs';

const approval = { live: true, authorization: LIVE_AUTHORIZATION, maxCalls: TOTAL_CALLS,
  apiKey: 'SYNTHETIC_NOT_REAL', runAttempt: '1' };

function fakeFetch({ failAt = -1, mismatch = false, wrongAt = -1 } = {}) {
  const plan = buildPlan();
  let count = 0;
  return {
    get count() { return count; },
    async call(url, options) {
      const index = count++;
      assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
      assert.equal(options.method, 'POST');
      const sent = JSON.parse(options.body);
      assert.equal(sent.model, BENCHMARK_MODEL);
      assert.equal(sent.state, plan[index].state);
      assert.deepEqual(Object.keys(sent.questions.verdict.criteria), Object.keys(plan[index].criteria));
      assert.equal('expected' in sent, false);
      if (index === failAt) return { ok: false, status: 429 };
      const choices = Object.keys(plan[index].criteria);
      const choice = index === wrongAt ? choices.find((key) => key !== plan[index].expected) : plan[index].expected;
      return { ok: true, async json() {
        return { model: mismatch ? 'jev-1.13.0' : BENCHMARK_MODEL,
          usage: { input_tokens: 120, output_tokens: 21, unsafe_data: 'HIDDEN' },
          evaluation_time_ms: 18,
          answers: { verdict: { type: 'choice', choice, confidence: 0.96,
            probabilities: Object.fromEntries(choices.map((key) => [key, key === choice ? 0.96 : 0.02])) } } };
      } };
    },
  };
}

test('fixture matrix has five public scenarios, three positions per correct answer', () => {
  const plan = buildPlan();
  assert.equal(plan.length, 15);
  assert.equal(BENCHMARK_CASES.length, 5);
  for (const item of BENCHMARK_CASES) {
    const rows = plan.filter((p) => p.caseId === item.id);
    assert.equal(rows.length, 3);
    assert.deepEqual(rows.map((r) => Object.keys(r.criteria).indexOf(item.expected)), [Object.keys(item.options).indexOf(item.expected), (Object.keys(item.options).indexOf(item.expected) + 2) % 3, (Object.keys(item.options).indexOf(item.expected) + 1) % 3]);
  }
});

test('dry run defaults to no egress, with a reproducible 15-cell plan', async () => {
  const f = fakeFetch();
  const out = await runBenchmark({ fetchImpl: f.call });
  assert.equal(out.status, 'not_run');
  assert.equal(out.attemptedCalls, 0);
  assert.equal(out.plan.length, 15);
  assert.equal(f.count, 0);
});

test('wrong approval, budget, model, or rerun attempt fail closed', async () => {
  for (const patch of [
    { authorization: '' }, { maxCalls: 14 }, { maxCalls: 60 }, { apiKey: null },
    { runAttempt: '2' }, { model: 'jev-latest' },
  ]) {
    const f = fakeFetch();
    const out = await runBenchmark({ ...approval, ...patch, fetchImpl: f.call });
    assert.equal(out.status, 'not_run');
    assert.equal(out.attemptedCalls, 0);
    assert.equal(f.count, 0);
  }
});

test('15 mocks produce scored results without leaking provider extras or secrets', async () => {
  const f = fakeFetch();
  const captured = [];
  const out = await runBenchmark({ ...approval, fetchImpl: f.call, now: () => 1,
    onRecord: (record) => captured.push(record) });
  assert.equal(out.status, 'complete');
  assert.equal(out.attemptedCalls, 15);
  assert.equal(f.count, 15);
  assert.equal(captured.length, 15);
  assert.deepEqual(out.summary, { correctCount: 15, accuracy: 1, criticalFailures: 0,
    overconfidentErrors: 0, meetsProvisionalTargets: true });
  assert.deepEqual(out.results[0].usage, { input_tokens: 120, output_tokens: 21 });
  assert.equal(out.results[0].upstreamEvaluationMs, 18);
  assert.equal(JSON.stringify(out).includes('SYNTHETIC_NOT_REAL'), false);
  assert.equal(JSON.stringify(out).includes('HIDDEN'), false);
});

test('wrong high-confidence result is flagged, not treated as accurate', async () => {
  const f = fakeFetch({ wrongAt: 1 });
  const out = await runBenchmark({ ...approval, fetchImpl: f.call });
  assert.equal(out.status, 'complete');
  assert.equal(out.summary.correctCount, 14);
  assert.equal(out.summary.overconfidentErrors, 1);
  assert.equal(out.summary.meetsProvisionalTargets, false);
});

test('429 stops immediately without retries or spending remaining budget', async () => {
  const f = fakeFetch({ failAt: 1 });
  const out = await runBenchmark({ ...approval, fetchImpl: f.call });
  assert.equal(out.status, 'incomplete');
  assert.equal(out.reason, 'upstream_http_error');
  assert.equal(out.attemptedCalls, 2);
  assert.equal(f.count, 2);
});

test('unexpected upstream model halts even if answer shape is valid', async () => {
  const f = fakeFetch({ mismatch: true });
  const out = await runBenchmark({ ...approval, fetchImpl: f.call });
  assert.equal(out.status, 'incomplete');
  assert.equal(out.reason, 'model_mismatch');
  assert.equal(out.attemptedCalls, 1);
});

test('cannot silently expand fixture count or fake expected option', () => {
  assert.throws(() => buildPlan([]), /exactly five/);
  assert.throws(() => buildPlan(BENCHMARK_CASES.map((c, i) => i === 0 ? { ...c, expected: 'nonexistent' } : c)), /invalid synthetic/);
});
