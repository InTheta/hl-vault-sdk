import { LeaderTradingClient } from "@intheta/hl-vault-sdk";

const client = new LeaderTradingClient({
  baseUrl: process.env.HL_VAULT_TRADE_API_URL ?? "https://trade.example.com",
  token: process.env.HL_VAULT_TOKEN,
});

const capabilities = await client.capabilities();
const account = await client.account();
console.log({ vault: capabilities.vault, spot: account.spot?.balances });

const order = await client.placeOrder({
  market: capabilities.allowed_markets[0] ?? "SOL",
  side: "buy",
  limit_px: 50,
  size: 0.24,
  tif: "Alo",
});
console.log(order);
