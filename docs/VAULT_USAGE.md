# Run a vault on the current testnet

Start with the [source installation and package build](../README.md#install).
The scoped npm package is not published yet.

The leader logs in with the wallet that created the vault. The vault is a smart
contract, with no separate password or private key to import.

## Leader

1. Connect the leader wallet on HyperEVM Testnet (998). Read live protocol config.
   Wait if creation is paused; another signature cannot restore a platform worker.
2. Mint mock mUSD and keep testnet HYPE for gas. Use the runtime creation fee and
   minimum seed; the creation fee is spent, while the separate seed buys shares.
3. Create the vault, wait for the receipt and finish/claim the seed setup.
4. Activate trading in Terminal and approve the configured builder fee once.
   HyperCore confirmation and independent on-chain verification can take time.
   Keep status visible and poll; do not restart the signing sequence while waiting.
5. When verification completes, enable public deposits. This is a separate leader
   decision; finishing trading setup does not automatically open public deposits.
6. Use the vault selected in Terminal to trade. Check Core trading equity before
   opening a position; review actual fills, fees, remaining orders and positions
   after closing. API agents require scoped leader authorization and persistent
   client order IDs. Reuse the same ID when retrying the same order intent.

## Follower

Discover a current, non-archived vault; inspect its leader, network, setup and
deposit gates. Connect your own wallet, approve the asset if needed, then request
a deposit. Wait for epoch settlement and claim shares. For withdrawal, request
redemption, respect the lock and settlement, then claim the asset. The leader
also follows this share lifecycle for their investor position.

See [Follower lifecycle](FOLLOWER_LIFECYCLE.md) for cancellation and ABI calls.
Neither a request receipt nor a shares claim proves HyperCore cash moved.

## Display the next action

```ts
import { describeVaultDepositSetup } from "@intheta/hl-vault-sdk";
const config = await publicClient.protocolConfig();
const vault = await publicClient.vault(vaultAddress);
const next = describeVaultDepositSetup(config, vault);
console.log(next.actor, next.message);
```

Poll config and vault status every ten seconds while waiting, with bounded retry
and a visible last-updated time. This helper is display guidance, not permission
to submit a transaction. Before signing, refresh on-chain balances, allowances,
admission, caps, lockup, reserves and pending requests.

`builder_verifier_status` distinguishes `starting`, `ready`, `paused` (platform
builder eligibility), `degraded`, `unavailable`, `stale`, and `disabled` (manual
operator verification). `builder_verifier_automatic` means a fresh successful
inspection, not that this specific vault has already been verified.

## Capital boundary

The active mock-mUSD testnet shares and HyperCore funds are separate ledgers.
Mock deposits do not fund trading; mock share redemptions do not return Core
cash. Contract NAV is not audited trading performance. Linked-USDC custody,
reconciliation, full lifecycle evidence and independent audit remain required
before mainnet capital. Do not deposit real capital into this demonstration.
