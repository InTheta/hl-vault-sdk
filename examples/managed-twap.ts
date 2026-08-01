import { LeaderTradingClient } from "../src/index.js";

const baseUrl = process.env.HL_VAULT_EXECUTOR_URL;
const token = process.env.HL_VAULT_AGENT_TOKEN;
if (!baseUrl || !token) {
  throw new Error("Set HL_VAULT_EXECUTOR_URL and HL_VAULT_AGENT_TOKEN");
}

const client = new LeaderTradingClient({ baseUrl, token });
const result = await client.startManagedTwap({
  market: process.env.MARKET ?? "SOL",
  side: process.env.SIDE === "sell" ? "sell" : "buy",
  size: Number(process.env.SIZE ?? "0.3"),
  minutes: Number(process.env.MINUTES ?? "5"),
  randomize: true,
});

console.log(JSON.stringify(result, null, 2));
console.log("Use cancelManagedTwap(twapId) or cancelAllOrders() for emergency recovery.");
