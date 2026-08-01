import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBasketOrders,
  buildBoundedMarketOrder,
  buildScaledOrders,
  connectVaultUserStream,
  type Address,
} from "../src/index.js";

test("builds bounded IOC buy and sell orders", () => {
  assert.equal(buildBoundedMarketOrder({
    market: "SOL",
    side: "buy",
    referencePrice: 100,
    size: 1,
    maxSlippageBps: 50,
  }).limit_px, 100.49999999999999);
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
