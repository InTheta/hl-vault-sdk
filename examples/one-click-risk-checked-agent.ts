import {
  LeaderTradingClient,
  OmniDataPlaneClient,
  buildScaledOrders,
  extractLiquidationLevels,
  type LiquidationStatsSnapshot,
} from "../src/index.js";

const executorUrl = required("HL_VAULT_EXECUTOR_URL");
const agentToken = required("HL_VAULT_AGENT_TOKEN");
const dataUrl = required("OMNI_DATA_URL");
const market = process.env.MARKET ?? "SOL";
const symbol = process.env.SYMBOL ?? market;
const side = process.env.SIDE === "sell" ? "sell" : "buy";
const strategy = process.env.STRATEGY === "twap" ? "twap" : "maker-ladder";
const execute = process.env.EXECUTE === "1";

const trading = new LeaderTradingClient({ baseUrl: executorUrl, token: agentToken });
const data = new OmniDataPlaneClient({
  baseUrl: dataUrl,
  ...(process.env.OMNI_DATA_API_TOKEN
    ? { apiKey: process.env.OMNI_DATA_API_TOKEN }
    : {}),
});

const [capabilities, account, news, liquidations, marginStress] = await Promise.all([
  trading.capabilities(),
  trading.account(),
  data.news(symbol, 10),
  data.liquidationStats<LiquidationStatsSnapshot>("hyperliquid", symbol, "current"),
  data.marginStress(24),
]);

if (!capabilities.allowed_markets.includes(market)) {
  throw new Error(`${market} is outside this vault's server-enforced market allowlist`);
}
const accountValue = Number(account.perps?.marginSummary?.accountValue);
if (!Number.isFinite(accountValue) || accountValue <= 0) {
  throw new Error("Vault account has no positive, current margin value");
}
const mid = Number(liquidations.data?.stats?.mid);
if (!Number.isFinite(mid) || mid <= 0) {
  throw new Error("Omni liquidation snapshot has no finite positive mid price");
}

const requestedNotional = Math.min(
  Number(process.env.NOTIONAL_USD ?? "20"),
  capabilities.max_notional_usd,
);
if (!Number.isFinite(requestedNotional) || requestedNotional < 20) {
  throw new Error("Use 20 USDC or more so two maker/TWAP slices clear HL minimums");
}
if (requestedNotional > accountValue * 5) {
  throw new Error("Example margin guard blocks notional above 5x current account value");
}

const newsText = JSON.stringify(news).toLowerCase();
if (side === "buy" && /\b(severe|critical|bearish)\b/.test(newsText)) {
  throw new Error("AI-news guard blocked a new long; inspect the current news context");
}
if (/\bcritical\b/.test(JSON.stringify(marginStress).toLowerCase())) {
  throw new Error("Margin-stress guard blocked new execution");
}

const strongestLiquidations = extractLiquidationLevels(liquidations, 5);
const size = requestedNotional / mid;
const plan = strategy === "twap"
  ? {
      strategy,
      request: { market, side, size, minutes: 5, randomize: true },
    }
  : {
      strategy,
      request: buildScaledOrders({
        market,
        side,
        totalSize: size,
        startPrice: mid * (side === "buy" ? 0.995 : 1.005),
        endPrice: mid * (side === "buy" ? 0.99 : 1.01),
        levels: 2,
        tif: "Alo",
      }),
    };

console.log(JSON.stringify({
  execute,
  vault: capabilities.vault,
  builder: capabilities.builder,
  builderFeeDecibps: capabilities.builder_fee_decibps,
  market,
  accountValue,
  requestedNotional,
  strongestLiquidations,
  plan,
}, null, 2));

if (!execute) {
  console.log("Preview only. Re-run with EXECUTE=1 after reviewing the bounded plan.");
} else if (strategy === "twap") {
  console.log(await trading.startManagedTwap(plan.request as {
    market: string;
    side: "buy" | "sell";
    size: number;
    minutes: number;
    randomize: boolean;
  }));
} else {
  console.log(await trading.placeOrderBatch(plan.request as ReturnType<typeof buildScaledOrders>));
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
