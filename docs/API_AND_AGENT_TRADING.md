# API and agent trading

Automations use short-lived, leader-signed delegation rather than a leader key
or operator token. The grant is the intersection of the leader's requested
limits and the executor's stricter vault policy.

## Bootstrap once with the leader wallet

```ts
const delegated = await trading.delegateAgent(
  leaderAddress,
  {
    agentId: "maker-sol-1",
    scopes: ["account_read", "orders_read", "orders_write", "orders_cancel"],
    allowedMarkets: ["SOL"],
    maxNotionalUsd: 25,
    allowTaker: false,
    sessionExpiresAt: Date.now() + 30 * 60_000,
  },
  (message) => walletClient.signMessage({ account: leaderAddress, message }),
);
```

Deliver `delegated.token` directly to the agent secret store. Do not print it.
Revoke by `sessionId`; otherwise it expires in at most one hour.

## Runtime loop

1. Read `capabilities()` and `account()`.
2. Read market data separately (Hyperliquid public API, Omni data, or x402).
3. Reject stale data and plans outside signed limits.
4. Preview a bounded plan; require an explicit production execute flag.
5. Submit with stable client order IDs.
6. Consume WebSocket fills/order updates and reconcile with HTTP snapshots.
7. Cancel outstanding orders on stale state, shutdown or lost connectivity.

The SDK provides single orders, atomic batches, scaled ladders, weighted
baskets, reduce-only closes and managed TWAP. An unbounded market order is not
provided. `exchange()` exists only for compatible allowed Hyperliquid action
shapes; the gateway removes untrusted nonce/signature/builder fields and rejects
transfers, withdrawals, builder changes and unknown actions.

MCP runs locally with the delegated token (`hl-vault-mcp`). x402 is a separate
paid intelligence surface: a payer credential never becomes an execution
credential. Give every process only one vault token and one narrowly scoped
data credential, rotate both, redact authorization headers, and apply an
external loss/position kill switch in addition to gateway limits.
