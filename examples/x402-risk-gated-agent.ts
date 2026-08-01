import {
  LeaderTradingClient,
  OmniX402Client,
  buildBoundedMarketOrder,
} from "@intheta/hl-vault-sdk";

declare const fetchWithPayment: typeof fetch;

// Payment authority and trading authority are deliberately separate objects.
const intelligence = new OmniX402Client({
  baseUrl: "https://omniterminal.app",
  fetch: fetchWithPayment,
});
const trading = new LeaderTradingClient({
  baseUrl: process.env.HL_VAULT_TRADE_API_URL ?? "https://trade.example.com",
  token: process.env.HL_VAULT_AGENT_TOKEN,
});

const risk = await intelligence.marketRisk("SOL", 60, 10);
if (risk.schema !== "market_risk_snapshot.v1" || risk.freshness.status !== "fresh") {
  throw new Error("Risk snapshot is stale or has an unexpected schema");
}
const liquidationSummary = risk.liquidations?.summary as { mid?: unknown } | undefined;
const referencePrice = Number(liquidationSummary?.mid);
if (!Number.isFinite(referencePrice) || referencePrice <= 0) {
  throw new Error("Risk snapshot has no valid market reference price");
}
const marketContext = risk.news?.market_context as { direction?: unknown } | undefined;
if (marketContext?.direction === "BEARISH") {
  throw new Error("Example policy blocks new long risk during bearish news context");
}

console.log(await trading.placeOrder(buildBoundedMarketOrder({
  market: "SOL",
  side: "buy",
  referencePrice,
  size: 0.05,
  maxSlippageBps: 20,
})));
