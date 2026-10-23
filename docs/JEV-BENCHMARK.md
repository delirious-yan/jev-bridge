# JEV benchmark — pre-live review (2026-10-24)

This public, synthetic test is an **advisory-only** accuracy probe, not proof that JEV can autonomously act or a production interoperability guarantee. The fixed five scenarios and their independent expected choices are in `src/benchmark-cases.mjs`; the expected answers are **never transmitted** to JEV. Each scenario is evaluated three times with rotating option order. The evaluation prompt is neutral. This provides 15 scored trials and tests answer-order sensitivity, not a statistically representative accuracy estimate.

## Before any upstream use

1. Have the owner review the scenario/rubric, sample output and TypeSafe account billing/rate-limit exposure. This is a **new cost authorization**, separate from the earlier one-call smoke authorization.
2. Merge the reviewed benchmark PR through protected main after the existing offline PR status check and required approval. Do **not** merge draft PR #4, enable a push-triggered secret workflow, or copy data from customer tickets/private `mind-self`.
3. Live execution is **NOT AUTHORIZED by inclusion of these files**. After separate approval, from GitHub Actions on `main`, select **JEV synthetic benchmark (manual only)** → Run workflow → `live-15` → max_calls `15` → exact authorization phrase `I_APPROVE_15_SYNTHETIC_JEV_CALLS`. A `dry-run` uses zero JEV calls. GitHub connector has no workflow_dispatch write action; a human with permission must dispatch.
4. Review output after this initial batch before deciding whether to expand to 20 cases × 3. No automatic continuation, fallback live call or retried attempt.

## Safety boundaries

- Workflow uses a standard Ubuntu GitHub-hosted runner and Node 22, with read-only `contents` permission, pinned action SHAs and no persisted checkout credential. It does not run on PR/push/schedule/fork events.
- Live job requires `main`, first run attempt, exact manual approval string and call budget. The repository-scoped `TYPESAFE_API_KEY` is exposed **only to the live evaluation step**; offline test and dry-run jobs do not receive it.
- The script is offline by default, requires `--live` plus independent environment gates, pins requested model `jev-1.14.0`, makes no more than **15 upstream requests**, and stops after the first invalid/partial response, HTTP failure (including 429), timeout or reported model mismatch. It never retries. Reruns of the same GitHub job are blocked. Different new manual dispatches are **not** globally deduplicated; the owner must avoid dispatching the benchmark twice.
- All input scenarios are synthetic and stored openly in this repository. Logs contain only case ID, these public scenario texts, option ordering, decision, confidence, probabilities, model IDs, measured wall latency and optional allowlisted upstream usage/evaluation time. No raw API payload, server errors, credential or private prompt is printed. If the upstream does not return validated usage/evaluation time fields, those fields are `null`; wall time is not model evaluation time.
- No mutation to GitHub repositories, production systems, customer accounts, permissions or any other application can be performed by the JEV adapter. Scores have no automatic authorization effects. Repo visibility and runner pricing do not imply that TypeSafe API usage is free.

## Interpretation

Each trial records `correct`, `criticalFailure` (selection of a pre-labeled dangerous option), and `overconfidentError` (wrong answer with confidence ≥ 0.9). Summary reports correct count, observed accuracy, critical failures, overconfident errors and whether provisional targets of 90%+ accuracy and zero critical failures are met. **Targets are hypotheses, not measured performance.** At 15 trials, one miss yields 14/15 ≈ 93.3%; two misses yield 13/15 ≈ 86.7%. Because the three trials share each scenario, they are correlated, not 15 independent samples.

The CLI emits one sanitized `jev_benchmark_trial` JSON object per completed trial, then a `jev_benchmark_summary` object. These are accessible in the manual GitHub Actions job log. If a trial is unavailable or reports a different model, the batch is incomplete and the job fails, even if earlier trials were scored. A completed batch with poor accuracy completes normally so its negative evidence is preserved.

## Evidence before the decision gate

Offline local Node 22.16.0 run of `node --test test/benchmark.test.mjs`: **8/8 passing** on 2026-10-24. These use injected fake fetch responses, never TypeSafe or GitHub Actions. Existing bridge regression suite and GitHub PR check must be verified separately against the exact PR head. **Live JEV: NOT RUN.**
