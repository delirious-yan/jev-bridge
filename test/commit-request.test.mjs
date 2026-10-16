import test from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const validator = new URL("../scripts/validate-jev-request.mjs", import.meta.url);
const valid = {
  approved: true,
  fixture: "browser-tab",
  kind: "live-synthetic-smoke",
  requestId: "jev-20261016-a1b2c3d4",
};

function checkRequest(input, { raw = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "jev-request-test-"));
  try {
    mkdirSync(join(root, "scripts"));
    mkdirSync(join(root, "jev-requests"));
    copyFileSync(validator, join(root, "scripts", "validate-jev-request.mjs"));
    if (input !== undefined)
      writeFileSync(join(root, "jev-requests", "current.json"), raw ? input : JSON.stringify(input));
    return spawnSync(process.execPath, [join(root, "scripts", "validate-jev-request.mjs")], {
      encoding: "utf8", env: { PATH: process.env.PATH },
      timeout: 5000,
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("only the approved fixed synthetic fixture is accepted", () => {
  const result = checkRequest(valid);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Validated one synthetic read-only JEV smoke request/);
});

test("invalid or absent approval fails closed", () => {
  for (const approved of [false, null, "true", 1, undefined]) {
    const result = checkRequest({ ...valid, approved });
    assert.notEqual(result.status, 0);
  }
});

test("unrecognized or flexible test intent is rejected", () => {
  for (const update of [
    { kind: "run-arbitrary-script" }, { fixture: "customer-ticket" },
    { requestId: "any" }, { requestId: "jev-20261016-ABCDEFGH" },
    { extra: "unexpected" },
  ]) assert.notEqual(checkRequest({ ...valid, ...update }).status, 0);
});

test("bad JSON, absent request, non-object, and oversized files fail closed", () => {
  assert.notEqual(checkRequest(undefined).status, 0);
  assert.notEqual(checkRequest("{", { raw: true }).status, 0);
  assert.notEqual(checkRequest(null).status, 0);
  assert.notEqual(checkRequest("x".repeat(700), { raw: true }).status, 0);
});
