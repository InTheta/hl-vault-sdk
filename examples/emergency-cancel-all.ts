import { LeaderTradingClient } from "../src/index.js";

const trading = new LeaderTradingClient({
  baseUrl: process.env.HL_VAULT_EXECUTOR_URL ?? "https://vault-trade.example",
  token: process.env.HL_VAULT_AGENT_TOKEN,
});

// With no market filter, a leader/operator session cancels every vault order.
// A delegated token remains limited to the markets in its signed grant.
const result = await trading.cancelAllOrders({ markets: ["SOL"] });
console.log({
  accepted: result.accepted,
  matched: result.matched,
  cancelled: result.cancelled,
  failed: result.failed,
  managedTwapsStopped: result.managed_twaps_stopped,
});
