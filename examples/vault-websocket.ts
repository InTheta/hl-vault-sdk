import { createReconnectingVaultUserStream, type Address } from "@intheta/hl-vault-sdk";

const vault = process.env.HL_VAULT_ADDRESS as Address | undefined;
if (!vault) throw new Error("Set HL_VAULT_ADDRESS");

const stream = createReconnectingVaultUserStream({
  url: "wss://api.hyperliquid-testnet.xyz/ws",
  vault,
  subscriptions: [
    { type: "webData3" },
    { type: "clearinghouseState", dex: "test" },
    { type: "openOrders", dex: "test" },
    { type: "orderUpdates" },
    { type: "userFills", aggregateByTime: true },
  ],
  reconnectDelayMs: 500,
  maxReconnectDelayMs: 10_000,
  onStatus: (status, attempt) => console.error(`vault stream: ${status} (${attempt})`),
  onMessage: (message) => console.log(message),
  onClose: () => console.error("vault stream disconnected; reconnecting"),
});

process.once("SIGINT", () => stream.close());
