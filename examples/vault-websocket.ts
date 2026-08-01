import { connectVaultUserStream, type Address } from "@intheta/hl-vault-sdk";

const vault = process.env.HL_VAULT_ADDRESS as Address | undefined;
if (!vault) throw new Error("Set HL_VAULT_ADDRESS");

const socket = connectVaultUserStream({
  url: "wss://api.hyperliquid-testnet.xyz/ws",
  vault,
  subscriptions: [
    { type: "webData3" },
    { type: "clearinghouseState", dex: "test" },
    { type: "openOrders", dex: "test" },
    { type: "orderUpdates" },
    { type: "userFills", aggregateByTime: true },
  ],
  onMessage: (message) => console.log(message),
  onClose: () => console.log("vault stream closed"),
});

process.once("SIGINT", () => socket.close());
