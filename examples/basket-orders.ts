import { LeaderTradingClient, buildBasketOrders } from "@intheta/hl-vault-sdk";

const client = new LeaderTradingClient({
  baseUrl: process.env.HL_VAULT_TRADE_API_URL ?? "https://trade.example.com",
  token: process.env.HL_VAULT_TOKEN,
});

const basket = buildBasketOrders({
  totalNotionalUsd: 20,
  maxSlippageBps: 25,
  legs: [
    { market: "SOL", side: "buy", weight: 0.5, referencePrice: 150 },
    { market: "test:ABC", side: "sell", weight: 0.3, referencePrice: 10 },
    { market: "#102180", side: "buy", weight: 0.2, referencePrice: 0.45 },
  ],
});

console.log(await client.placeOrderBatch(basket));
