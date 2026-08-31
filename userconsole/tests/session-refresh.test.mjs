import assert from "node:assert/strict";
import test from "node:test";
import {
  accessTokenNeedsRefresh,
  jwtExpirationMs,
  RefreshCoordinator,
} from "../src/lib/api/session-refresh.ts";

function unsignedToken(expiresAtSeconds) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ exp: expiresAtSeconds })}.signature`;
}

test("access token is refreshed before its expiration window", () => {
  const now = Date.UTC(2026, 7, 11, 10, 0, 0);
  const tenMinutesLater = Math.floor((now + 10 * 60 * 1000) / 1000);
  const fourMinutesLater = Math.floor((now + 4 * 60 * 1000) / 1000);

  assert.equal(
    accessTokenNeedsRefresh(unsignedToken(tenMinutesLater), now),
    false,
  );
  assert.equal(
    accessTokenNeedsRefresh(unsignedToken(fourMinutesLater), now),
    true,
  );
});

test("missing or malformed access tokens require refresh", () => {
  assert.equal(accessTokenNeedsRefresh(undefined), true);
  assert.equal(accessTokenNeedsRefresh("not-a-jwt"), true);
  assert.equal(jwtExpirationMs("not-a-jwt"), null);
});

test("concurrent refreshes share one request and briefly reuse its result", async () => {
  let now = 1_000;
  let calls = 0;
  const coordinator = new RefreshCoordinator(10_000, () => now);
  const refresh = async () => {
    calls += 1;
    await Promise.resolve();
    return { kind: "success", token: `token-${calls}` };
  };
  const retainSuccess = (result) => result.kind === "success";

  const [first, second] = await Promise.all([
    coordinator.run("old-refresh-token", refresh, retainSuccess),
    coordinator.run("old-refresh-token", refresh, retainSuccess),
  ]);
  const graceResult = await coordinator.run(
    "old-refresh-token",
    refresh,
    retainSuccess,
  );

  assert.equal(calls, 1);
  assert.deepEqual(first, second);
  assert.deepEqual(first, graceResult);

  now += 10_001;
  const renewed = await coordinator.run(
    "old-refresh-token",
    refresh,
    retainSuccess,
  );
  assert.equal(calls, 2);
  assert.equal(renewed.token, "token-2");
});

test("failed refreshes are not cached", async () => {
  let calls = 0;
  const coordinator = new RefreshCoordinator();
  const refresh = async () => {
    calls += 1;
    return { kind: "unavailable" };
  };

  await coordinator.run("refresh-token", refresh, () => false);
  await coordinator.run("refresh-token", refresh, () => false);

  assert.equal(calls, 2);
});
