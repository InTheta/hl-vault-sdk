import {
  LeaderTradingClient,
  OmniX402Client,
  buildBoundedMarketOrder,
} from "@intheta/hl-vault-sdk";

declare const fetchWithPayment: typeof fetch;
type Risk = { blocked: boolean; markPrice: number; reason?: string };

// Payment authority and trading authority are deliberately separate objects.
const intelligence = new OmniX402Client({
  baseUrl: "https://omniterminal.app",
  fetch: fetchWithPayment,
});
const trading = new LeaderTradingClient({
  baseUrl: process.env.HL_VAULT_TRADE_API_URL ?? "https://trade.example.com",
  token: process.env.HL_VAULT_AGENT_TOKEN,
});

const risk = await intelligence.marketRisk<Risk>("SOL", 60, 10);
if (risk.blocked) throw new Error(`Risk gate blocked trading: ${risk.reason ?? "unspecified"}`);

console.log(await trading.placeOrder(buildBoundedMarketOrder({
  market: "SOL",
  side: "buy",
  referencePrice: risk.markPrice,
  size: 0.05,
  maxSlippageBps: 20,
})));
