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
