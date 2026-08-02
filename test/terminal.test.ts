import assert from "node:assert/strict";
import test from "node:test";
import {
  VaultTerminalClient,
  buildClaimDepositTransaction,
  buildDepositTransactions,
  buildFollowerReadRequests,
  buildRedeemTransaction,
  type Address,
  type TerminalIntegrationManifest,
} from "../src/index.js";

const vault = "0x2222222222222222222222222222222222222222" as Address;
const asset = "0x3333333333333333333333333333333333333333" as Address;

const manifest: TerminalIntegrationManifest = {
  schema: "https://omniterminal.app/schemas/hl-vault-terminal-integration/v1",
  release_stage: "testnet_preview",
  network: {
    name: "testnet",
    chain_id: 998,
    rpc_url: "https://rpc.hyperliquid-testnet.xyz/evm",
    explorer_url: "https://app.hyperliquid-testnet.xyz",
  },
  contracts: {
    asset,
    asset_decimals: 6,
    factory: "0x4444444444444444444444444444444444444444",
    vault_abi: "@intheta/hl-vault-sdk#asyncHyperVaultAbi",
    factory_abi: "@intheta/hl-vault-sdk#publicVaultFactoryAbi",
  },
  public_api: {
    base_url: "https://vault-api.example.com",
    manifest_path: "/v1/integration/manifest",
    vaults_path: "/v1/vaults",
    vault_path_template: "/v1/vaults/{vault}",
    performance_path_template: "/v1/vaults/{vault}/performance",
    points_leaderboard_path: "/v1/points/leaderboard",
    wallet_points_path_template: "/v1/points/wallet/{wallet}",
  },
  hyperliquid: {
    api_url: "https://api.hyperliquid-testnet.xyz",
    websocket_url: "wss://api.hyperliquid-testnet.xyz/ws",
    user: "vault contract address",
    direct_public_reads: true,
  },
  leader_execution: {
    gateway_url: "https://trade.example.com",
    authentication: "leader EIP-191 challenge or delegated agent token",
    session_storage: "memory_only",
    builder_fee_required: true,
    builder_fee_recipient: "0x5555555555555555555555555555555555555555",
    builder_fee_decibps: 10,
    caller_builder_override: false,
    browser_origins_require_registration: true,
  },
  follower_flow: {
    asynchronous: true,
    transactions_enabled: true,
    operations: ["approve_asset", "request_deposit", "claim_deposit", "request_redeem"],
    deposit_lock_seconds: 86_400,
    entry_fee_bps: 0,
    generic_withdrawal_fee_bps: 0,
    positive_profit_share_bps: 1_000,
  },
  sdk: {
    package: "@intheta/hl-vault-sdk",
    repository: "https://github.com/InTheta/hl-vault-sdk",
    minimum_version: "0.2.0",
  },
  security: {
    custody: "wallet-signed HyperEVM contract transactions",
    trading_tokens: "vault-scoped and trade-only",
    funding_authority: false,
    mainnet_enabled: false,
    nav_authoritative: false,
  },
};

test("discovers an external-terminal integration and loads a unified dashboard", async () => {
  const calls: Array<{ url: string; body: unknown }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, body });
    if (url.endsWith("/v1/integration/manifest")) return Response.json(manifest);
    if (url.includes("/performance")) {
      return Response.json({ address: vault, points: [], observation_count: 0 });
    }
    if (url.endsWith(`/v1/vaults/${vault}`)) {
      return Response.json({ address: vault, name: "External terminal vault" });
    }
    if (body?.type === "clearinghouseState") return Response.json({ withdrawable: "5" });
    if (body?.type === "spotClearinghouseState") return Response.json({ balances: [] });
    if (body?.type === "openOrders") return Response.json([]);
    if (body?.type === "portfolio") return Response.json([]);
    throw new Error(`unexpected request ${url}`);
  };

  const terminal = await VaultTerminalClient.connect({
    vaultApiUrl: "https://vault-api.example.com/",
    fetch: fetcher,
  });
  const dashboard = await terminal.dashboard(vault);
  assert.equal(dashboard.vault.address, vault);
  assert.equal(dashboard.account.perps.withdrawable, "5");
  assert.equal(terminal.requireTrading().constructor.name, "LeaderTradingClient");
  assert(calls.some((call) => call.url === "https://api.hyperliquid-testnet.xyz/info"));
});

test("builds wallet-owned follower transactions without custody or SDK signing", () => {
  const [approve, deposit] = buildDepositTransactions({ asset, vault, assets: 25_000_000n });
  assert.deepEqual(
    [approve.address, approve.functionName, approve.args],
    [asset, "approve", [vault, 25_000_000n]],
  );
  assert.deepEqual(
    [deposit.address, deposit.functionName, deposit.args],
    [vault, "requestDeposit", [25_000_000n]],
  );
  assert.equal(buildClaimDepositTransaction(vault).functionName, "claimDeposit");
  assert.equal(buildRedeemTransaction(vault, 1n).functionName, "requestRedeem");
  assert.deepEqual(
    buildFollowerReadRequests(vault, asset).map((request) => request.functionName),
    [
      "balanceOf",
      "depositRequests",
      "redeemRequests",
      "costBasisAssets",
      "lockupUntil",
      "currentEpoch",
    ],
  );
  assert.throws(
    () => buildDepositTransactions({ asset, vault, assets: 0n }),
    /assets must be positive/,
  );
});

test("refuses an integration manifest with an unknown schema", async () => {
  await assert.rejects(
    VaultTerminalClient.connect({
      vaultApiUrl: "https://vault-api.example.com",
      fetch: async () => Response.json({ ...manifest, schema: "https://attacker.invalid/v2" }),
    }),
    /Unsupported vault integration manifest/,
  );
});
