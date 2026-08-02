import {
  LeaderTradingClient,
  type Address,
  type SignMessage,
} from "../src/index.js";

const baseUrl = process.env.HL_VAULT_EXECUTOR_URL;
const leader = process.env.HL_VAULT_LEADER as Address | undefined;
if (!baseUrl || !leader) throw new Error("Set HL_VAULT_EXECUTOR_URL and HL_VAULT_LEADER");

// Supply this callback from a browser wallet or an isolated leader signing
// process. Never put a leader private key in this script.
const signMessage: SignMessage = async (_message) => {
  throw new Error("Connect a leader wallet and return its EIP-191 signature");
};

const client = new LeaderTradingClient({ baseUrl });
const session = await client.delegateAgent(
  leader,
  {
    agentId: "example-risk-bot",
    scopes: [
      "account_read",
      "orders_read",
      "orders_write",
      "orders_cancel",
      "twaps_read",
      "twaps_write",
    ],
    allowedMarkets: ["SOL"],
    maxNotionalUsd: 10,
    allowTaker: false,
    sessionExpiresAt: Date.now() + 30 * 60_000,
  },
  signMessage,
);

// Store only the opaque session.token in the agent host's secret environment.
console.log({ sessionId: session.sessionId, expiresAt: session.expiresAt, token: "<redacted>" });
