# Coinbase AgentKit, Base and Robinhood Chain

The optional [integration](../integrations/agentkit/smoke.mjs) uses the actual
Coinbase `@coinbase/agentkit` package, pinned to 0.10.4. It registers one custom
read action and invokes it through AgentKit with live Omni vault configuration,
discovery and BTC liquidation data. It checks fresh RPC blocks on Base Sepolia
and Robinhood Chain testnet, and rejects transfers. It needs no signing key,
CDP account or LLM key. This verifies framework/tool compatibility and live data
consumption; it does not prove autonomous decisions, CDP custody, fills or PnL.

```bash
npm ci
npm run build
cd integrations/agentkit
npm ci
npm run test:live
```

`OMNI_VAULT_API_URL`, `OMNI_DATA_URL` and `OMNI_SYMBOL` can select an authorized
deployment and symbol. Defaults use the public DEV vault console API and public
Omni data routes. HTTP failures, wrong chain IDs, missing setup fields, stale
blocks or stale liquidation data fail the test. No paid x402 request is made.

| Agent host network | Chain ID | Role |
| --- | --- | --- |
| Base Sepolia | 84532 | Public read-only RPC probe |
| Robinhood Chain testnet | 46630 | Public read-only RPC probe |
| HyperEVM testnet | 998 | Omni vault contracts and execution |

A Base or Robinhood wallet does not move a HyperEVM vault onto that chain.
Robinhood Chain integration here uses Coinbase's EVM-compatible AgentKit
framework; it is not an official Robinhood agent SDK or brokerage integration.

For actual vault trading, obtain the leader's explicit, short-lived delegation
using `LeaderTradingClient`, with scoped markets and bounded notional. Persist
UUID order IDs across retries. Never grant the agent deposits, withdrawals,
transfers or vault administration. Keep paid-data credentials separate.

CDP-managed wallet tests require separately provisioned CDP credentials and a
dedicated test wallet. LLM-driven tests also require an inference provider.
Live trading acceptance requires confirmed fills, builder fees, cancel-all,
reduce-only exit, zero residual orders, reconciled positions and revocation.
Mainnet vault execution remains disabled pending independent readiness gates.

The latest AgentKit dependency tree still has upstream audit findings, including
`bigint-buffer` and `ws` high-severity advisories. This example is an isolated,
keyless read probe; do not deploy it with custody credentials. The core SDK
does not depend on AgentKit. Its read-only structural wallet avoids AgentKit's
unhandled telemetry request, which returned HTTP 400 during validation.

Authoritative references:
[Coinbase AgentKit](https://github.com/coinbase/agentkit/tree/main/typescript/agentkit),
[Base network information](https://docs.base.org/chain/network-information),
[Robinhood network configuration](https://docs.robinhood.com/chain/connecting/).
