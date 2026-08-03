# Testing and release verification

Run all hermetic checks before connecting a funded testnet wallet:

```bash
npm ci
npm run check
cd python
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev,evm]"
.venv/Scripts/python -m pytest
.venv/Scripts/python -m ruff check .
.venv/Scripts/python -m mypy src
.venv/Scripts/python -m build
```

Testnet smoke tests must use a dedicated, minimally funded wallet and small
orders. Verify discovery, dashboard snapshot, WebSocket reconnect, wallet
challenge, ALO submit/cancel, IOC bounded order, batch, reduce-only exit, TWAP
start/cancel, follower request/cancel/claim and points/fill reconciliation.
Record transaction hashes and order IDs, but never keys or bearer tokens.

Automated examples preview by default and submit only with `EXECUTE=1`. Do not
run live examples in CI. Mainnet use remains blocked until authoritative NAV,
real custody/redemption proof, durable nonce/idempotency recovery, fee/fill
reconciliation, emergency unwind, key rotation and an independent security
audit have passed.
