import {
  LeaderTradingClient,
  OmniDataPlaneClient,
  buildScaledOrders,
} from "@intheta/hl-vault-sdk";

type LiquidationLevel = { price: number; notionalUsd: number; side: "long" | "short" };
type LiquidationResponse = { levels: LiquidationLevel[] };

const data = new OmniDataPlaneClient({
  baseUrl: process.env.OMNI_DATA_URL ?? "https://data.omniterminal.app",
  apiKey: process.env.OMNI_DATA_API_TOKEN,
});
const trading = new LeaderTradingClient({
  baseUrl: process.env.HL_VAULT_TRADE_API_URL ?? "https://trade.example.com",
  token: process.env.HL_VAULT_TOKEN,
});

const snapshot = await data.liquidationStats<LiquidationResponse>(
  "hyperliquid",
  "SOL",
  "aggregate",
);
const strongest = [...snapshot.levels].sort((a, b) => b.notionalUsd - a.notionalUsd)[0];
if (!strongest) throw new Error("No liquidation level is available");

// Illustrative only: a real strategy must add staleness, spread, inventory,
// drawdown and kill-switch checks before it is permitted to place an order.
const fadeSide = strongest.side === "long" ? "buy" : "sell";
const distance = fadeSide === "buy" ? -0.003 : 0.003;
const orders = buildScaledOrders({
  market: "SOL",
  side: fadeSide,
  totalSize: 0.1,
  startPrice: strongest.price * (1 + distance),
  endPrice: strongest.price * (1 + distance * 3),
  levels: 3,
  tif: "Alo",
});
console.log(await trading.placeOrderBatch(orders));
