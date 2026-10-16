import test from "node:test";
import assert from "node:assert/strict";
import { evaluateChoice, TYPESAFE_ENDPOINT } from "../src/jev.mjs";

const input = {
  state: { instruction: "Open the previous tab" },
  instructions: "What tab action is requested?",
  criteria: {
    previous: "Switch to the previous tab",
    new_tab: "Open a new tab",
    no_match: "Neither action",
  },
};

function mockResponse() {
  return {
    ok: true,
    async json() {
      return {
        model: "jev-1.13.0",
        answers: {
          verdict: {
            type: "choice", choice: "previous", confidence: 0.92,
            probabilities: { previous: 0.92, new_tab: 0.03, no_match: 0.05 },
          },
        },
      };
    },
  };
}

test("offline by default: never contacts upstream", async () => {
  let called = 0;
  const result = await evaluateChoice({
    ...input, apiKey: "synthetic", fetchImpl: () => { called++; throw Error("not allowed"); },
  });
  assert.equal(result.status, "not_run");
  assert.equal(result.executionEffect, "none");
  assert.equal(called, 0);
});

test("absent key is unavailable without network egress", async () => {
  let called = 0;
  const result = await evaluateChoice({
    ...input, allowNetwork: true, fetchImpl: () => { called++; throw Error("not allowed"); },
  });
  assert.equal(result.reason, "missing_api_key");
  assert.equal(called, 0);
});

test("one bounded choice request yields non-executing advisory", async () => {
  let called = 0;
  const result = await evaluateChoice({
    ...input, allowNetwork: true, apiKey: "synthetic",
    async fetchImpl(url, request) {
      called++;
      assert.equal(url, TYPESAFE_ENDPOINT);
      assert.equal(request.method, "POST");
      assert.equal(request.headers.Authorization, "Bearer synthetic");
      const body = JSON.parse(request.body);
      assert.equal(body.questions.verdict.type, "choice");
      assert.deepEqual(body.questions.verdict.criteria, input.criteria);
      assert.deepEqual(body.state, input.state);
      return mockResponse();
    },
  });
  assert.equal(called, 1);
  assert.deepEqual(result, {
    status: "advisory", choice: "previous", confidence: 0.92,
    probabilities: { previous: 0.92, new_tab: 0.03, no_match: 0.05 },
    model: "jev-1.13.0", executionEffect: "none",
  });
});

test("rejects excessive or malformed state before transmission", async () => {
  await assert.rejects(evaluateChoice({
    ...input, state: "a".repeat(4001), allowNetwork: true, apiKey: "synthetic",
    fetchImpl: () => { throw Error("unexpected egress"); },
  }), RangeError);
  await assert.rejects(evaluateChoice({
    ...input, criteria: { only_one: "x" }, allowNetwork: true, apiKey: "synthetic",
    fetchImpl: () => { throw Error("unexpected egress"); },
  }), RangeError);
});

test("upstream HTTP errors do not reveal response or perform actions", async () => {
  const result = await evaluateChoice({
    ...input, allowNetwork: true, apiKey: "synthetic",
    fetchImpl: async () => ({ ok: false, status: 401, text: async () => "secret server response" }),
  });
  assert.deepEqual(result, {
    status: "unavailable", reason: "upstream_http_error", executionEffect: "none",
  });
});

test("rejects unexpected model answer instead of using it", async () => {
  const result = await evaluateChoice({
    ...input, allowNetwork: true, apiKey: "synthetic",
    fetchImpl: async () => ({
      ok: true, json: async () => ({
        answers: {
          verdict: {
            type: "choice", choice: "delete_all", confidence: 1,
            probabilities: { previous: 0.92, new_tab: 0.03, no_match: 0.05 },
          },
        },
      }),
    }),
  });
  assert.equal(result.status, "unavailable");
  assert.equal(result.reason, "invalid_upstream_response");
});

test("network failure returns non-executing unavailable", async () => {
  const result = await evaluateChoice({
    ...input, allowNetwork: true, apiKey: "synthetic",
    fetchImpl: async () => { throw Error("sensitive upstream failure"); },
  });
  assert.equal(result.reason, "request_failed");
  assert.equal(result.executionEffect, "none");
});

test("rejects malformed criteria labels before network access", async () => {
  let called = 0;
  const neverFetch = () => { called++; throw Error("unexpected egress"); };
  for (const invalidKey of ["UPPERCASE", "has spaces", "-leading", "a".repeat(33)]) {
    await assert.rejects(evaluateChoice({
      ...input,
      criteria: { [invalidKey]: "Invalid option", valid: "Valid option" },
      allowNetwork: true, apiKey: "synthetic", fetchImpl: neverFetch,
    }), RangeError);
  }
  await assert.rejects(evaluateChoice({
    ...input, criteria: { first: "", second: "Valid option" },
    allowNetwork: true, apiKey: "synthetic", fetchImpl: neverFetch,
  }), RangeError);
  assert.equal(called, 0);
});

test("rejects unsupported or non-JSON-serializable state before network access", async () => {
  let called = 0;
  const neverFetch = () => { called++; throw Error("unexpected egress"); };
  const circular = { description: "loop" };
  circular.self = circular;
  const cases = [
    { state: () => "not JSON", expected: TypeError },
    { state: Symbol("not JSON"), expected: TypeError },
    { state: { count: 1n }, expected: TypeError },
    { state: circular, expected: TypeError },
  ];
  for (const { state, expected } of cases) {
    await assert.rejects(evaluateChoice({
      ...input, state, allowNetwork: true, apiKey: "synthetic", fetchImpl: neverFetch,
    }), expected);
  }
  assert.equal(called, 0);
});

test("malformed JSON from HTTP 200 is unavailable and never leaks parser details", async () => {
  const result = await evaluateChoice({
    ...input, allowNetwork: true, apiKey: "synthetic",
    fetchImpl: async () => ({
      ok: true,
      json: async () => { throw SyntaxError("upstream private payload and key"); },
    }),
  });
  assert.deepEqual(result, {
    status: "unavailable", reason: "request_failed", executionEffect: "none",
  });
  assert.equal(JSON.stringify(result).includes("private payload"), false);
});

test("HTTP 200 with invalid JSON shapes cannot become actionable advice", async () => {
  for (const payload of [null, true, "not an object", [], {}, { answers: null }]) {
    const result = await evaluateChoice({
      ...input, allowNetwork: true, apiKey: "synthetic",
      fetchImpl: async () => ({ ok: true, json: async () => payload }),
    });
    assert.deepEqual(result, {
      status: "unavailable", reason: "invalid_upstream_response", executionEffect: "none",
    });
  }
});

test("bad upstream confidence or probabilities are rejected", async () => {
  const invalidAnswers = [
    { type: "choice", choice: "previous", confidence: 1.1, probabilities: { previous: 1, new_tab: 0, no_match: 0 } },
    { type: "choice", choice: "previous", confidence: NaN, probabilities: { previous: 1, new_tab: 0, no_match: 0 } },
    { type: "choice", choice: "previous", confidence: 0.9, probabilities: { previous: 0.9, new_tab: -0.1, no_match: 0.2 } },
    { type: "choice", choice: "previous", confidence: 0.9, probabilities: { previous: 0.9, new_tab: 0.1 } },
  ];
  for (const verdict of invalidAnswers) {
    const result = await evaluateChoice({
      ...input, allowNetwork: true, apiKey: "synthetic",
      fetchImpl: async () => ({ ok: true, json: async () => ({ answers: { verdict } }) }),
    });
    assert.equal(result.status, "unavailable");
    assert.equal(result.reason, "invalid_upstream_response");
    assert.equal(result.executionEffect, "none");
  }
});
