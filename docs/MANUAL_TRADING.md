# Manual leader trading

Manual vault trading should feel like normal terminal trading. The only extra
step is selecting the account scope and proving the connected wallet controls
the vault leader.

## UX sequence

1. Leader selects **Personal** or a named **Vault** in the account switcher.
2. For a locked vault, the terminal requests `/v1/auth/challenge`.
3. The wallet signs the returned message with EIP-191 `personal_sign`.
4. The terminal exchanges it at `/v1/auth/session` and stores the returned
   vault-bound token in memory only.
5. The existing order ticket now submits through `LeaderTradingClient`.
6. Expiry, wallet/account change, tab close or explicit lock clears the token.

```ts
const trading = terminal.requireTrading();
const session = await trading.authorizeLeader(leaderAddress, (message) =>
  walletClient.signMessage({ account: leaderAddress, message }),
);
// Do not persist session.token.
await trading.placeOrder({
  market: "SOL", side: "buy", limit_px: 145, size: 0.1, tif: "Alo",
});
```

Before enabling the submit button, fetch `capabilities()` and show the vault,
allowed market, max notional, taker policy and mandatory builder fee. Never ask
the user to paste a session token. Never place it in a URL, local/session
storage, analytics or error reports.

Use IOC with a visible slippage bound for market-style orders, ALO for maker
orders, and `reduce_only: true` for exits. Treat a session expiry as locked and
require a new signature. The wallet signature grants trading only: it must not
authorize deposits, withdrawals, transfers or account/key changes.
