# HL Vault Python SDK

Typed, synchronous Python 3.11+ building blocks for terminal backends, leader
bots and constrained agents. It supports public discovery and state, direct
Hyperliquid reads, EIP-191 wallet authentication, delegated sessions, bounded
orders, batches, cancels, managed TWAP, reconnecting WebSockets, Omni data and
follower contract-call construction.

This library never contains an executor or custody key. A private key is only
needed by the optional server-side wallet-auth example; production bots should
receive a short-lived delegated token and keep the leader wallet offline.

## Install and verify

```bash
cd python
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev,evm]"  # Windows
.venv/Scripts/python -m pytest
.venv/Scripts/python -m ruff check .
.venv/Scripts/python -m mypy src
```

On macOS/Linux replace `.venv/Scripts/python` with `.venv/bin/python`.

## Discover vaults

```python
import os
from hl_vault_sdk import VaultTerminalClient

with VaultTerminalClient.connect(os.environ["HL_VAULT_API_URL"]) as terminal:
    vaults = terminal.public.vaults()["vaults"]
    dashboard = terminal.dashboard(vaults[0]["address"])
    print(dashboard["account"]["perps"].get("assetPositions", []))
```

## Safely submit an order

```python
import os
from hl_vault_sdk import LeaderTradingClient, bounded_market_order

with LeaderTradingClient(
    os.environ["HL_VAULT_GATEWAY_URL"], token=os.environ["HL_VAULT_AGENT_TOKEN"]
) as trading:
    policy = trading.capabilities()
    order = bounded_market_order(
        market=policy["allowed_markets"][0], side="buy",
        reference_price=100, size=0.1, max_slippage_bps=30,
    )
    result = trading.place_order(**order)
```

The gateway replaces caller-supplied signatures, nonces, vault addresses and
builder metadata. Funding, withdrawals, key management and builder changes are
not in the public trading interface. See the repository integration guide and
`examples/` for complete dry-run-first programs.

`OmniX402Client` accepts a caller-created payment-enabled `httpx.Client`. The
SDK never accepts the payer key and never forwards an execution token to x402.
The examples cover discovery, wallet authentication and signing, scoped agent
delegation/revocation, bounded trading, scaled/basket/TWAP strategies,
Hyperliquid WebSocket reads, follower transactions and x402 intelligence.
