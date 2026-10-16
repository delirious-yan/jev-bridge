// Never read a dynamic path or request payload into the JEV model.
// GitHub Actions calls this before accessing TYPESAFE_API_KEY.
import { readFileSync, statSync } from "node:fs";

const requestUrl = new URL("../jev-requests/current.json", import.meta.url);
const allowed = ["approved", "fixture", "kind", "requestId"];
try {
  if (statSync(requestUrl).size > 512) throw Error("request exceeds 512 bytes");
  const request = JSON.parse(readFileSync(requestUrl, "utf8"));
  if (request === null || typeof request !== "object" || Array.isArray(request))
    throw Error("request must be an object");
  const keys = Object.keys(request).sort();
  if (JSON.stringify(keys) !== JSON.stringify(allowed))
    throw Error("unexpected request fields");
  if (request.approved !== true ||
      request.kind !== "live-synthetic-smoke" ||
      request.fixture !== "browser-tab" ||
      typeof request.requestId !== "string" ||
      !/^jev-[0-9]{8}-[a-z0-9]{8}$/.test(request.requestId))
    throw Error("request not approved for the fixed synthetic fixture");
  // Only the hard-coded synthetic fixture in scripts/live-smoke.mjs is executed.
  console.log("Validated one synthetic read-only JEV smoke request");
} catch (error) {
  console.error("Rejected JEV smoke request:", error?.message ?? "invalid request");
  process.exitCode = 1;
}
