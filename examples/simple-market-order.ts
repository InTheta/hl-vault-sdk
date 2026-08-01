import { LeaderTradingClient, buildBoundedMarketOrder } from "@intheta/hl-vault-sdk";

const client = new LeaderTradingClient({
  baseUrl: process.env.HL_VAULT_TRADE_API_URL ?? "https://trade.example.com",
  token: process.env.HL_VAULT_TOKEN,
});

// Obtain this from a fresh BBO or mark-price feed. This is not a raw, unbounded
// market order: IOC is capped at 30 bps from the observed reference price.
const referencePrice = 150;
const result = await client.placeOrder(buildBoundedMarketOrder({
  market: "SOL",
  side: "buy",
  referencePrice,
  size: 0.1,
  maxSlippageBps: 30,
}));
console.log(result);
