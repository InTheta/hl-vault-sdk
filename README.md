# HL Vault SDK

Public TypeScript client for public strategy vaults that trade Hyperliquid
validator markets, HIP-3 perpetuals and HIP-4 outcomes through one vault-owned
account.

The SDK intentionally contains only public client code, API types, contract
ABIs and examples. Agent signing, custody, execution policy, reconciliation,
deployment configuration and infrastructure remain private platform concerns.

> Pre-1.0 software. Testnet integration is available; do not use this package
> to custody production funds until the platform's audits and public launch
> gates are complete.

## Install

The GitHub repository is public. Publishing the scoped package to npm is a
separate release step and has not happened yet. For development:

```bash
git clone https://github.com/InTheta/hl-vault-sdk.git
cd hl-vault-sdk
npm install
npm run check
```

The clients use the standard Fetch API. The optional `hl-vault-mcp` executable
uses the official MCP TypeScript SDK and Zod for validated tool inputs.

## Public follower reads

```ts
import { PublicVaultClient } from "@intheta/hl-vault-sdk";

const vaults = new PublicVaultClient({
  baseUrl: "https://vault-api.example.com",
});

const list = await vaults.vaults();
const selected = await vaults.vault(list.vaults[0].address);
const performance = await vaults.performance(selected.address);
```

Accounting fields are explicit. `tvl_usdc` is the reported contract NAV;
`core_spot_usdc` and Core risk fields are live trading-account observations.
Applications should treat performance as authoritative only when
`contract_nav_authoritative` is true.

## Server-side leader bot

```ts
import { LeaderTradingClient } from "@intheta/hl-vault-sdk";

const trading = new LeaderTradingClient({
  baseUrl: "https://trade.example.com",
  token: process.env.HL_VAULT_TOKEN,
});

const policy = await trading.capabilities();
const account = await trading.account();
const result = await trading.placeOrder({
  market: policy.allowed_markets[0],
  side: "buy",
  limit_px: 50,
  size: 0.24,
  tif: "Alo",
});
```

Bot tokens are secrets. Never ship them in browser bundles or public
configuration. Public Hyperliquid reads and WebSocket subscriptions may go
directly to Hyperliquid using the vault address; authenticated writes use the
gateway so risk policy and the mandatory builder code are applied before the
vault agent signs.

No public order method accepts a builder override. The executor injects the
configured builder after validating the vault, action, market and notional, so
omitting or changing the fee in a caller cannot bypass it.

## Omni market-intelligence data

Leaders can use the same public Omni data plane as the terminal without gaining
access to private node addresses or platform infrastructure:

```ts
import { OmniDataPlaneClient } from "@intheta/hl-vault-sdk";

const data = new OmniDataPlaneClient({
  baseUrl: "https://data.omniterminal.app",
  apiKey: process.env.OMNI_DATA_API_TOKEN,
});

const [news, liquidations, book] = await Promise.all([
  data.news("BTC"),
  data.liquidationStats("hyperliquid", "BTC", "aggregate"),
  data.orderbook("BTC", 100),
]);
```

The data token, when required by the selected plan, is read-only and separate
from the vault leader trading token.

## Paid x402 intelligence

`OmniX402Client` accepts a caller-supplied payment-enabled Fetch implementation.
The SDK never accepts a payer private key or decides an agent's spending policy:

```ts
import { OmniX402Client } from "@intheta/hl-vault-sdk";

const intelligence = new OmniX402Client({
  baseUrl: "https://omniterminal.app",
  fetch: fetchWithPayment,
});

const risk = await intelligence.marketRisk("SOL");
const carry = await intelligence.marketCarry("SOL");
```

Omni's x402 MCP is a paid data surface only. Payment credentials never grant
vault execution authority.

## Provisional points preview

`pointsPreview()` models the current anti-gaming rules using settled fill
volume and time-weighted capital. The output is explicitly provisional and
`token_entitlement` is always false; points do not promise a token or airdrop.
Verified testnet points carry into the first mainnet season at 20%, capped at
50,000 points and subject to anti-Sybil review. Use
`pointsCarryoverPreview()` to inspect the deterministic policy.

## Wallet-authenticated manual trading

```ts
const session = await trading.authorizeLeader(address, async (message) => {
  return walletClient.signMessage({ account: address, message });
});
```

The callback signs a short-lived EIP-191 challenge. The returned session is
vault-scoped and should remain in memory only. It does not grant fund-transfer
or account-administration authority.

## Delegated AI trading

The leader can sign a narrower agent session without sharing their wallet,
operator bearer, or Hyperliquid API-agent key:

```ts
const agent = await trading.delegateAgent(
  address,
  {
    agentId: "risk-bot-1",
    scopes: ["account_read", "orders_read", "orders_write", "orders_cancel"],
    allowedMarkets: ["SOL"],
    maxNotionalUsd: 10,
    allowTaker: false,
    sessionExpiresAt: Date.now() + 30 * 60_000,
  },
  (message) => walletClient.signMessage({ account: address, message }),
);
```

Each signed field is enforced by the executor and intersected with its stricter
vault policy. Agent sessions last no more than one hour and are revocable by
session ID. They cannot use the raw HL proxy, transfer funds, change builders,
or manage account authority.

For MCP-capable agents, run the local stdio adapter with only the opaque token:

```bash
HL_VAULT_EXECUTOR_URL=https://trade.example.com \
HL_VAULT_AGENT_TOKEN=<opaque-agent-token> \
npx hl-vault-mcp
```

The adapter offers explicit account, open-order, order, reduce-only close,
cancel and TWAP-read tools. Use Omni's x402 MCP separately for paid data. Do not
forward an inbound MCP OAuth token to either downstream service.

## HL-compatible access

Use `info()` and `exchange()` when migrating an existing Hyperliquid client.
The gateway accepts familiar request shapes but replaces untrusted nonces,
signatures and builder fields before signing. Transfers, withdrawals, agent
management, builder changes and unknown actions fail closed.

```ts
const state = await trading.info({
  type: "clearinghouseState",
  user: "0x0000000000000000000000000000000000000000",
});

const response = await trading.exchange({
  action: {
    type: "cancelByCloid",
    cancels: [{ asset: 0, cloid: "0x..." }],
  },
  vaultAddress: policy.vault,
});
```

## Use from another Hyperliquid front end

The front end may keep its own market UI and use Omni only as the vault
execution boundary. For the current testnet vault deployment:

```ts
import { LeaderTradingClient } from "@intheta/hl-vault-sdk";

const vault = new LeaderTradingClient({
  baseUrl: "https://vault-gateway.omniterminal.app",
});

await vault.authorizeLeader(leaderAddress, (message) =>
  walletClient.signMessage({ account: leaderAddress, message }),
);

const [account, orders] = await Promise.all([
  vault.account(),
  vault.openOrders(),
]);

await vault.placeOrder({
  market: "test:ABC",
  side: "buy",
  limit_px: 10.5,
  size: 1,
  tif: "Alo",
});
```

The application supports browser CORS for challenge/session onboarding and
authenticated account, order, cancel, TWAP, `info` and `exchange` calls. The
example hostname represents the planned public gateway; the current development
hostname is Cloudflare Access-protected and is not an open cross-origin API.
Keep the resulting short-lived bearer in memory; do not put it in a URL, local
storage or logs.

This is not a direct signing wrapper around Hyperliquid. Every authenticated
write passes through the vault executor, which binds the action to its vault,
applies the risk allowlist and injects the mandatory builder immediately before
the trade-only agent signs. The SDK has no builder parameter, and the public
proxy rejects funding, withdrawal, transfer, builder-change and arbitrary
paths. Another front end can replace Omni's UX, but cannot bypass the fee.

The current testnet public origin targets one configured vault executor. A
multi-vault router keyed by authenticated session claims—not caller-provided
upstream URLs—is required before exposing many vaults through one origin.

## Contract integration

`erc20Abi`, `publicVaultFactoryAbi` and `asyncHyperVaultAbi` are exported for
use with viem, ethers or another EVM client. The SDK deliberately does not
choose a wallet framework or embed deployment addresses.

## Development

```bash
npm install
npm run check
```

See `examples/` for follower, bot and wallet-session entry points.

## Security

Do not open public issues containing credentials, wallet material or sensitive
deployment information. Use GitHub's private security-advisory flow described
in `SECURITY.md`.
