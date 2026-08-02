import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBasketOrders,
  buildBoundedMarketOrder,
  buildScaledOrders,
  connectVaultUserStream,
  createReconnectingVaultUserStream,
  extractLiquidationLevels,
  type Address,
} from "../src/index.js";

test("builds bounded IOC buy and sell orders", () => {
  assert.equal(buildBoundedMarketOrder({
    market: "SOL",
    side: "buy",
    referencePrice: 100,
    size: 1,
    maxSlippageBps: 50,
  }).limit_px, 100.5);
  assert.equal(buildBoundedMarketOrder({
    market: "SOL",
    side: "sell",
    referencePrice: 100,
    size: 1,
    maxSlippageBps: 50,
  }).limit_px, 99.5);
});

test("builds scaled ladders and weighted baskets within the batch limit", () => {
  const ladder = buildScaledOrders({
    market: "SOL",
    side: "buy",
    totalSize: 1,
    startPrice: 100,
    endPrice: 96,
    levels: 3,
  });
  assert.deepEqual(ladder.map((order) => order.limit_px), [100, 98, 96]);
  assert.equal(ladder.reduce((sum, order) => sum + order.size, 0), 1);

  const basket = buildBasketOrders({
    totalNotionalUsd: 100,
    maxSlippageBps: 10,
    legs: [
      { market: "SOL", side: "buy", weight: 3, referencePrice: 20 },
      { market: "test:ABC", side: "sell", weight: 1, referencePrice: 5 },
    ],
  });
  assert.equal(basket.length, 2);
  assert.equal(basket[0]?.size, 3.75);
  assert.equal(basket[1]?.size, 5);
});

test("subscribes to Hyperliquid with the vault address as user", () => {
  const handlers = new Map<string, Array<(event: any) => void>>();
  const sent: string[] = [];
  const socket = {
    addEventListener(type: string, listener: (event: any) => void) {
      handlers.set(type, [...(handlers.get(type) ?? []), listener]);
    },
    send(value: string) { sent.push(value); },
  } as unknown as WebSocket;
  const messages: unknown[] = [];
  connectVaultUserStream({
    url: "wss://api.hyperliquid-testnet.xyz/ws",
    vault: "0x2222222222222222222222222222222222222222" as Address,
    subscriptions: [{ type: "orderUpdates" }, { type: "userFills" }],
    webSocketFactory: () => socket,
    onMessage: (message) => messages.push(message),
  });
  for (const handler of handlers.get("open") ?? []) handler({});
  assert.deepEqual(sent.map((value) => JSON.parse(value)), [
    { method: "subscribe", subscription: { type: "orderUpdates", user: "0x2222222222222222222222222222222222222222" } },
    { method: "subscribe", subscription: { type: "userFills", user: "0x2222222222222222222222222222222222222222" } },
  ]);
  for (const handler of handlers.get("message") ?? []) handler({ data: '{"channel":"orderUpdates"}' });
  assert.deepEqual(messages, [{ channel: "orderUpdates" }]);
});

test("normalizes and ranks Omni liquidation buckets", () => {
  const levels = extractLiquidationLevels({
    data: {
      stats: {
        buckets: [
          { price: 100, long_liq_size: 2, long_count: 3 },
          { price: 105, short_liq_size: 4, short_count: 5 },
          { price: 0, long_liq_size: 100 },
        ],
      },
    },
  });
  assert.deepEqual(levels, [
    {
      price: 105,
      side: "short",
      size: 4,
      notionalUsd: 420,
      positionCount: 5,
      source: "bucket",
    },
    {
      price: 100,
      side: "long",
      size: 2,
      notionalUsd: 200,
      positionCount: 3,
      source: "bucket",
    },
  ]);
});

test("reconnects and resubscribes a vault user stream after an unexpected close", async () => {
  type Handler = (event: any) => void;
  const sockets: Array<{
    handlers: Map<string, Handler[]>;
    sent: string[];
    closed: boolean;
  }> = [];
  const statuses: string[] = [];
  const controller = createReconnectingVaultUserStream({
    url: "wss://api.hyperliquid-testnet.xyz/ws",
    vault: "0x2222222222222222222222222222222222222222" as Address,
    subscriptions: [{ type: "orderUpdates" }],
    reconnectDelayMs: 0,
    maxReconnectDelayMs: 0,
    webSocketFactory: () => {
      const state = { handlers: new Map<string, Handler[]>(), sent: [] as string[], closed: false };
      sockets.push(state);
      return {
        addEventListener(type: string, listener: Handler) {
          state.handlers.set(type, [...(state.handlers.get(type) ?? []), listener]);
        },
        send(value: string) { state.sent.push(value); },
        close() { state.closed = true; },
      } as unknown as WebSocket;
    },
    onMessage: () => undefined,
    onStatus: (status) => statuses.push(status),
  });
  for (const handler of sockets[0]?.handlers.get("open") ?? []) handler({});
  assert.equal(controller.status(), "open");
  assert.equal(sockets[0]?.sent.length, 1);
  for (const handler of sockets[0]?.handlers.get("close") ?? []) handler({});
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(sockets.length, 2);
  for (const handler of sockets[1]?.handlers.get("open") ?? []) handler({});
  assert.equal(sockets[1]?.sent.length, 1);
  controller.close();
  assert.equal(controller.status(), "closed");
  assert.equal(sockets[1]?.closed, true);
  assert(statuses.includes("reconnecting"));
});
