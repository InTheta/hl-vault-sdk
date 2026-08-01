import assert from "node:assert/strict";
import test from "node:test";
import {
  LeaderTradingClient,
  OmniDataPlaneClient,
  OmniX402Client,
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

test("binds agent delegation limits into the leader-signed challenge", async () => {
  const calls: Array<{ url: string; body: unknown }> = [];
  const sessionExpiresAt = Date.now() + 600_000;
  const fetcher: typeof fetch = async (input, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url: String(input), body });
    if (String(input).endsWith("/v1/auth/agent-challenge")) {
      return Response.json({
        challengeId: "delegation-challenge",
        message: "sign exact agent limits",
        challengeExpiresAt: Date.now() + 60_000,
        sessionExpiresAt: Date.now() + 600_000,
      });
    }
    return Response.json({
      token: "agent-token",
      sessionId: "session-id",
      expiresAt: Date.now() + 600_000,
      vault,
      agentId: "risk-bot-1",
      scopes: ["account_read", "orders_write"],
      allowedMarkets: ["SOL"],
      maxNotionalUsd: 10,
      allowTaker: false,
    });
  };
  const client = new LeaderTradingClient({ baseUrl: "https://trade.example.com", fetch: fetcher });
  const session = await client.delegateAgent(
    leader,
    {
      agentId: "risk-bot-1",
      scopes: ["account_read", "orders_write"],
      allowedMarkets: ["SOL"],
      maxNotionalUsd: 10,
      sessionExpiresAt,
    },
    async (message) => {
      assert.equal(message, "sign exact agent limits");
      return "0x5678" as Hex;
    },
  );
  assert.equal(session.agentId, "risk-bot-1");
  assert.deepEqual(calls[0]?.body, {
    address: leader,
    agentId: "risk-bot-1",
    scopes: ["account_read", "orders_write"],
    allowedMarkets: ["SOL"],
    maxNotionalUsd: 10,
    sessionExpiresAt,
    allowTaker: false,
  });
  assert.deepEqual(calls[1]?.body, {
    challengeId: "delegation-challenge",
    signature: "0x5678",
  });
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

test("submits an order basket through the single builder-tagged batch endpoint", async () => {
  let requestUrl = "";
  let requestBody: unknown;
  const client = new LeaderTradingClient({
    baseUrl: "https://trade.example.com",
    token: "delegated-token",
    fetch: async (input, init) => {
      requestUrl = String(input);
      requestBody = JSON.parse(String(init?.body));
      return Response.json({ accepted: true, orders: [] });
    },
  });
  const orders = [
    { market: "SOL", side: "buy" as const, limit_px: 100, size: 0.1, tif: "Alo" as const },
    { market: "test:ABC", side: "sell" as const, limit_px: 10, size: 1, tif: "Alo" as const },
  ];
  await client.placeOrderBatch(orders);
  assert.equal(requestUrl, "https://trade.example.com/v1/orders/batch");
  assert.deepEqual(requestBody, { orders });
  assert.throws(() => client.placeOrderBatch([]), /1 through 20/);
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

test("uses a caller-supplied payment fetch for x402 intelligence", async () => {
  const requests: string[] = [];
  const paymentFetch: typeof fetch = async (input) => {
    requests.push(String(input));
    return Response.json({ paid: true });
  };
  const client = new OmniX402Client({
    baseUrl: "https://omniterminal.app/",
    fetch: paymentFetch,
  });
  await client.marketRisk("SOL", 60, 5);
  await client.marketCarry("SOL");
  assert.equal(
    requests[0],
    "https://omniterminal.app/api/x402/v1/market-risk/SOL?scope=current&event_window_minutes=60&limit=5",
  );
  assert.equal(requests[1], "https://omniterminal.app/api/x402/v1/market-carry/SOL");
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

test("requests wallet-verified bounded testnet points carry-over", async () => {
  let body: unknown;
  const client = new PublicVaultClient({
    baseUrl: "https://api.example.com",
    fetch: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return Response.json({ carried_points: 2_000, eligible: true });
    },
  });
  await client.pointsCarryoverPreview({
    testnet_points: 10_000,
    identity_verified: true,
    anti_sybil_flags: [],
  });
  assert.deepEqual(body, {
    testnet_points: 10_000,
    identity_verified: true,
    anti_sybil_flags: [],
  });
});
