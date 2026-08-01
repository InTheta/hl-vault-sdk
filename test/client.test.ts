import assert from "node:assert/strict";
import test from "node:test";
import {
  LeaderTradingClient,
  OmniDataPlaneClient,
  PublicVaultClient,
  VaultApiError,
  type Address,
  type Hex,
} from "../src/index.js";

const leader = "0x1111111111111111111111111111111111111111" as Address;
const vault = "0x2222222222222222222222222222222222222222" as Address;

test("normalizes public API URLs and validates performance limits", async () => {
  const requests: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    requests.push(String(input));
    return Response.json({ vaults: [] });
  };
  const client = new PublicVaultClient({ baseUrl: "https://api.example.com/", fetch: fetcher });
  await client.vaults();
  assert.deepEqual(requests, ["https://api.example.com/v1/vaults"]);
  assert.throws(() => client.performance(vault, 1), /2 through 1000/);
});

test("exchanges a wallet signature for an in-memory leader token", async () => {
  const calls: Array<{ url: string; authorization: string | null; body: unknown }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({
      url: String(input),
      authorization: new Headers(init?.headers).get("Authorization"),
      body,
    });
    if (String(input).endsWith("/v1/auth/challenge")) {
      return Response.json({ challengeId: "challenge", message: "sign me", expiresAt: Date.now() + 60_000 });
    }
    if (String(input).endsWith("/v1/auth/session")) {
      return Response.json({ token: "session-token", expiresAt: Date.now() + 60_000, vault, leader });
    }
    return Response.json({ vault });
  };
  const client = new LeaderTradingClient({ baseUrl: "https://trade.example.com", fetch: fetcher });
  const session = await client.authorizeLeader(leader, async (message) => {
    assert.equal(message, "sign me");
    return "0x1234" as Hex;
  });
  await client.account();
  assert.equal(session.vault, vault);
  assert.deepEqual(calls[1]?.body, { challengeId: "challenge", signature: "0x1234" });
  assert.equal(calls[2]?.authorization, "Bearer session-token");
});

test("surfaces structured API failures", async () => {
  const client = new PublicVaultClient({
    baseUrl: "https://api.example.com",
    fetch: async () => Response.json({ error: "vault not found" }, { status: 404 }),
  });
  await assert.rejects(
    client.vault(vault),
    (error: unknown) =>
      error instanceof VaultApiError && error.status === 404 && error.message === "vault not found",
  );
});

test("builds public Omni data-plane requests without exposing infrastructure", async () => {
  const calls: Array<{ url: string; authorization: string | null }> = [];
  const client = new OmniDataPlaneClient({
    baseUrl: "https://data.example.com/",
    apiKey: "public-plan-token",
    fetch: async (input, init) => {
      calls.push({
        url: String(input),
        authorization: new Headers(init?.headers).get("Authorization"),
      });
      return Response.json({ ok: true });
    },
  });
  await client.news("BTC", 25);
  await client.liquidationStats("hyperliquid", "BTC", "aggregate");
  assert.equal(calls[0]?.url, "https://data.example.com/api/terminal/news/BTC?limit=25");
  assert.equal(
    calls[1]?.url,
    "https://data.example.com/api/terminal/liquidation-stats/hyperliquid/BTC?scope=aggregate",
  );
  assert.equal(calls[0]?.authorization, "Bearer public-plan-token");
});

test("serializes bigint point inputs for a provisional preview", async () => {
  let body: unknown;
  const client = new PublicVaultClient({
    baseUrl: "https://api.example.com",
    fetch: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return Response.json({ total_points: 123, provisional: true, token_entitlement: false });
    },
  });
  await client.pointsPreview({
    executed_volume_usd_e6: 1_000_000n,
    maker_volume_usd_e6: 0n,
    time_weighted_capital_usd_hours_e6: 0n,
    active_days: 1,
  });
  assert.deepEqual(body, {
    executed_volume_usd_e6: "1000000",
    maker_volume_usd_e6: "0",
    time_weighted_capital_usd_hours_e6: "0",
    active_days: 1,
  });
});
