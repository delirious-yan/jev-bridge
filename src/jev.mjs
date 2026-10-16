// Small, dependency-free TypeSafe/Jev bridge. No GitHub or other execution privileges.
export const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const DEFAULT_MODEL = "jev-latest";

const unavailable = (reason) => ({ status: "unavailable", reason, executionEffect: "none" });

export async function evaluateChoice({
  state, instructions, criteria, apiKey,
  model = DEFAULT_MODEL, endpoint = TYPESAFE_ENDPOINT,
  fetchImpl = globalThis.fetch, allowNetwork = false, timeoutMs = 8000,
} = {}) {
  // A hard opt-in prevents accidental billable/model calls from library consumers.
  if (!allowNetwork) return { status: "not_run", reason: "live_call_not_authorized", executionEffect: "none" };

  // Validate locally before any network request; do not ship whole repositories.
  if (typeof state !== "string" && (state === null || typeof state !== "object" || Array.isArray(state)))
    throw new TypeError("state must be a string or object");
  const stateText = JSON.stringify(state);
  if (!stateText || stateText.length > 4000 || stateText.length < 3)
    throw new RangeError("state must be nonempty and <=4000 serialized characters");
  if (typeof instructions !== "string" || !instructions.trim() || instructions.length > 320)
    throw new RangeError("instructions must contain 1-320 characters");
  if (criteria === null || typeof criteria !== "object" || Array.isArray(criteria))
    throw new TypeError("criteria must be a mapping of choice labels to descriptions");
  const entries = Object.entries(criteria);
  if (entries.length < 2 || entries.length > 8 ||
      entries.some(([key, value]) => !/^[a-z][a-z0-9_-]{0,31}$/.test(key) ||
        typeof value !== "string" || !value.trim() || value.length > 160))
    throw new RangeError("criteria need 2-8 short, described labels");
  if (typeof model !== "string" || !/^jev[-a-z0-9.]{1,50}$/.test(model))
    throw new RangeError("model must be a Jev model identifier");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 20000)
    throw new RangeError("timeoutMs must be between 1000 and 20000");
  if (endpoint !== TYPESAFE_ENDPOINT)
    throw new Error("Custom endpoints are not permitted by this initial bridge");
  if (typeof apiKey !== "string" || !apiKey.trim()) return unavailable("missing_api_key");
  if (typeof fetchImpl !== "function") return unavailable("missing_fetch");

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        state, model,
        questions: { verdict: { type: "choice", instructions, criteria } },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    // Never echo upstream body, request state, or authentication details.
    if (!response?.ok) return unavailable("upstream_http_error");
    const payload = await response.json();
    const answer = payload?.answers?.verdict;
    if (answer?.type !== "choice" ||
        !Object.hasOwn(criteria, answer.choice) ||
        typeof answer.confidence !== "number" ||
        !Number.isFinite(answer.confidence) ||
        answer.confidence < 0 || answer.confidence > 1)
      return unavailable("invalid_upstream_response");
    const probabilities = {};
    for (const [key] of entries) {
      const value = answer.probabilities?.[key];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)
        return unavailable("invalid_upstream_response");
      probabilities[key] = value;
    }
    return {
      status: "advisory", choice: answer.choice, confidence: answer.confidence,
      probabilities, model: typeof payload.model === "string" ? payload.model : model,
      executionEffect: "none",
    };
  } catch {
    return unavailable("request_failed");
  }
}
