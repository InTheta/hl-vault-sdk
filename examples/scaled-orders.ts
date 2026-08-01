import { LeaderTradingClient, buildScaledOrders } from "@intheta/hl-vault-sdk";

const client = new LeaderTradingClient({
  baseUrl: process.env.HL_VAULT_TRADE_API_URL ?? "https://trade.example.com",
  token: process.env.HL_VAULT_TOKEN,
});

const ladder = buildScaledOrders({
  market: "SOL",
  side: "buy",
  totalSize: 0.5,
  startPrice: 148,
  endPrice: 144,
  levels: 5,
  tif: "Alo",
});

// One gateway request, one builder-tagged Hyperliquid batch, one aggregate risk check.
console.log(await client.placeOrderBatch(ladder));
