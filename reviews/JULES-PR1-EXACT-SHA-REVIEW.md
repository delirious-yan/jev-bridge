# Independent Exact-SHA Source Review: JEV Bridge PR #1

**Reviewer:** Jules (Independent AI Software Engineer)
**Date:** October 16, 2026
**Target Repository:** `delirious-yan/jev-bridge`
**Candidate Branch:** `feat/read-only-jev-adapter-20261016`
**Exact Candidate Commit SHA:** `8e25667a68d70514104c719c152f870c9ac65e2b`
**Base Commit SHA:** `a8db138fd08f2e04d6c7899f5b969d5bc414e8ae` (`main`)
**Verdict:** **ACCEPT WITH FIXES**

---

## 1. Executive Summary & Review Scope

This independent source-only code review evaluated Candidate PR #1 at exact commit `8e25667a68d70514104c719c152f870c9ac65e2b`.

The review analyzed all 8 changed files in the candidate PR:
1. `.github/workflows/jev-manual-check.yml`
2. `.gitignore`
3. `AGENTS.md`
4. `README.md`
5. `package.json`
6. `scripts/live-smoke.mjs`
7. `src/jev.mjs`
8. `test/jev.test.mjs`

No project source code, workflow definitions, test files, lockfiles, or policies were modified during this review. This report is authored on a dedicated review branch based on clean `main`.

---

## 2. Verification & Execution Evidence Matrix

| Check / Context | Status | Execution Details & Evidence |
| :--- | :--- | :--- |
| **Candidate SHA Accessibility** | **VERIFIED** | SHA `8e25667a68d70514104c719c152f870c9ac65e2b` verified locally in git object store. |
| **Node 22 Unit Test Suite** | **EXECUTED (PASS)** | Extracted exact commit tree and executed `node --test test/jev.test.mjs` under Node.js v22.14.0. All 7 unit tests passed in 224ms. |
| **Live Authenticated TypeSafe API** | **NOT RUN** | Live API calls were deliberately not executed. `TYPESAFE_API_KEY` secret was not inspected or consumed. Zero API credits or billable tokens were used. |
| **GitHub Actions Workflows** | **NOT RUN** | GitHub Actions workflows (`.github/workflows/jev-manual-check.yml`) were confirmed to be manual-only (`workflow_dispatch`). No hosted workflows or self-hosted runners were dispatched or executed. |
| **Upstream Contract Comparison** | **VERIFIED** | Verified against official live TypeSafe API documentation (`https://docs.typesafe.ai/llms.txt` and `https://docs.typesafe.ai/api.md`). |

---

## 3. Upstream TypeSafe / JEV API Contract Alignment

The request structure and payload response validation in `src/jev.mjs` were compared against TypeSafe's official System One API documentation (`POST https://api.typesafe.ai/v1/systemone`):

* **Endpoint URL:** `https://api.typesafe.ai/v1/systemone` — Matches official documentation.
* **Request Payload Alignment:**
  * Top-level `state` accepts strings or JSON objects.
  * Top-level `model` defaults to `"jev-latest"`.
  * Top-level `questions` map maps question key (`verdict`) to `{ type: "choice", instructions, criteria }`.
* **Response Handling Alignment:**
  * Upstream response schema `answers.<id>` expects `{ type: "choice", choice, probabilities, confidence }`.
  * Probability map structure strictly validates that every choice key in criteria is present in `probabilities` and contains a numeric probability in `[0, 1]`.
  * `confidence` is validated as a finite number in `[0, 1]`.
* **Discrepancies / Observations:**
  * The bridge restricts questions strictly to 1 question named `verdict` of type `choice`. This matches the scope of a specialized single-choice advisory bridge.
  * The bridge strictly rejects any custom endpoint URL (`endpoint !== TYPESAFE_ENDPOINT`). While preventing SSRF, this prevents routing through enterprise proxies unless modified.

---

## 4. Security, Privacy & Safety Audit

1. **GitHub Actions Scoping & Execution Safety:**
   * `.github/workflows/jev-manual-check.yml` uses `on: workflow_dispatch` with `inputs.mode` choices (`offline-tests` / `live-synthetic`).
   * No automatic execution on `push` or `pull_request` events.
   * `TYPESAFE_API_KEY` secret is scoped exclusively to the `live-synthetic` job step.
   * Logs do not echo secrets, raw request state, or upstream payload responses.

2. **Network Egress & Default Safety:**
   * `allowNetwork` defaults to `false`. Without explicit opt-in (`allowNetwork: true`), calls return `{ status: "not_run", reason: "live_call_not_authorized", executionEffect: "none" }` without initiating network access.
   * If `apiKey` is missing or empty, returns `{ status: "unavailable", reason: "missing_api_key", executionEffect: "none" }` without sending network requests.

3. **Read-Only / Non-Authoritative Guarantee:**
   * `evaluateChoice` always includes `executionEffect: "none"` in all return paths.
   * All outputs are advisory structured data (`status`, `choice`, `confidence`, `probabilities`, `model`). No side effects, execution commands, or downstream authorizations are performed by `jev.mjs`.

4. **Input Bounding & Validation:**
   * `state` serialized length capped at 4,000 characters.
   * `instructions` length strictly capped at 1–320 characters.
   * `criteria` restricted to 2–8 keys matching `/^[a-z][a-z0-9_-]{0,31}$/` with descriptions capped at 160 characters.
   * `timeoutMs` bounded between 1,000ms and 20,000ms using native `AbortSignal.timeout`.

---

## 5. Concrete Actionable Issues & Findings

### Issue 1: `TypeError` when `state` contains unserializable types (e.g. functions or symbols)
* **Severity:** Medium
* **File:** `src/jev.mjs`
* **Line:** 18
* **Description:**
  In `src/jev.mjs`, line 18:
  ```js
  const stateText = JSON.stringify(state);
  if (!stateText || stateText.length > 4000 || stateText.length < 3)
  ```
  If `state` is a Function or Symbol (e.g., `evaluateChoice({ state: () => {}, ... })`), `JSON.stringify(state)` returns `undefined`. Subsequently, `stateText.length` throws an unhandled `TypeError: Cannot read properties of undefined (reading 'length')` rather than raising a clean input validation error.
* **Minimal Proposed Fix:**
  Change line 18 in `src/jev.mjs` to check `typeof stateText !== "string"`:
  ```js
  const stateText = JSON.stringify(state);
  if (typeof stateText !== "string" || stateText.length > 4000 || stateText.length < 3)
    throw new RangeError("state must be nonempty and <=4000 serialized characters");
  ```

---

### Issue 2: Missing unit tests for invalid criteria key formats and non-JSON 200 HTTP responses
* **Severity:** Low
* **File:** `test/jev.test.mjs`
* **Line:** 75–120
* **Description:**
  `test/jev.test.mjs` tests key guardrails, but lacks negative tests for:
  1. Criteria keys containing uppercase characters or spaces (e.g. `{ "ChoiceA": "description" }`), which fail criteria key regex validation.
  2. HTTP 200 OK responses returning invalid/malformed JSON or non-object payloads.
* **Minimal Proposed Fix:**
  Add negative unit tests in `test/jev.test.mjs`:
  ```js
  test("rejects invalid criteria key format", async () => {
    await assert.rejects(evaluateChoice({
      ...input, criteria: { INVALID_KEY: "desc", other: "desc2" },
      allowNetwork: true, apiKey: "synthetic",
      fetchImpl: () => { throw Error("unexpected egress"); },
    }), RangeError);
  });
  ```

---

### Issue 3: Inflexibility of custom endpoint blocking (Informational)
* **Severity:** Informational
* **File:** `src/jev.mjs`
* **Line:** 34–35
* **Description:**
  `if (endpoint !== TYPESAFE_ENDPOINT) throw new Error("Custom endpoints are not permitted by this initial bridge");` enforces security against SSRF during initial rollout. However, it prevents routing requests through local proxies, staging mocks, or corporate gateway endpoints.
* **Minimal Proposed Fix:**
  No immediate source change required for PR #1. If custom proxies are required in future iterations, allow an explicitly configured allowlist or option flag.

---

## 6. Verdict & Recommendation

**Verdict:** **ACCEPT WITH FIXES**

PR #1 represents a clean, dependency-free, and well-designed read-only adapter for TypeSafe JEV. It correctly implements safety defaults, input bounds, secret isolation, and non-executing advisory semantics. Addressing Issue 1 (handling `JSON.stringify` edge cases returning `undefined`) and adding the recommended negative unit tests in Issue 2 will ensure full production reliability.

*Note: This report PR is submitted from a clean branch based on `main` and contains no edits to candidate implementation files or PR #1.*
