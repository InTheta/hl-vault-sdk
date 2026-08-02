import {
  VaultTerminalClient,
  buildDepositTransactions,
  type Address,
} from "@intheta/hl-vault-sdk";

const api = process.env.HL_VAULT_API_URL;
if (!api) {
  throw new Error(
    "Set HL_VAULT_API_URL to the public manifest root; the Omni dev host requires Cloudflare Access",
  );
}
const terminal = await VaultTerminalClient.connect({ vaultApiUrl: api });
const list = await terminal.public.vaults();
const selected = list.vaults[0];
if (!selected) throw new Error("No public vault is available");

const dashboard = await terminal.dashboard(selected.address);
console.log({
  vault: dashboard.vault.address,
  tvl: dashboard.vault.tvl_usdc,
  positions: dashboard.account.perps.assetPositions ?? [],
  openOrders: dashboard.account.openOrders.length,
  builderFeeDecibps: terminal.manifest.leader_execution.builder_fee_decibps,
});

// Send these requests through the user's existing viem/ethers wallet adapter.
// The SDK returns call descriptions and never receives a follower private key.
if (terminal.manifest.contracts.asset) {
  const depositCalls = buildDepositTransactions({
    asset: terminal.manifest.contracts.asset,
    vault: selected.address as Address,
    assets: 25_000_000n,
  });
  console.log(depositCalls.map(({ address, functionName, args }) => ({
    address,
    functionName,
    args: args.map(String),
  })));
}

// For leaders, requireTrading().authorizeLeader(...) exchanges a wallet-signed
// challenge for an in-memory, vault-bound session. Server bots may instead pass
// a delegated token to VaultTerminalClient.connect(). All writes retain the
// platform builder code; callers cannot supply or replace it.
