// Actual Coinbase AgentKit tool invocation, public network/data reads only.
import assert from "node:assert/strict";
import { AgentKit, ActionProvider } from "@coinbase/agentkit";
import { z } from "zod";
import { PublicVaultClient, OmniDataPlaneClient } from "../../dist/index.js";

const networks = [
  { networkId: "base-sepolia", chainId: "84532", rpc: "https://sepolia.base.org" },
  { networkId: "robinhood-testnet", chainId: "46630", rpc: "https://rpc.testnet.chain.robinhood.com" },
];
const address = "0x0000000000000000000000000000000000000000";
async function rpc(network, method, params = []) {
  const response = await fetch(network.rpc, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  assert.equal(response.ok, true, `${network.networkId} RPC HTTP ${response.status}`);
  const result = await response.json();
  assert.equal(result.error, undefined, `${network.networkId} RPC error`);
  return result.result;
}
// Structural wallet interface avoids the upstream WalletProvider constructor's
// fire-and-forget analytics request. No telemetry, key or signing capability.
class ReadOnlyWallet {
  constructor(network) { this.network = network; }
  getAddress() { return address; }
  getName() { return "OmniReadOnlyNetworkProbe"; }
  getNetwork() { return { protocolFamily: "evm", networkId: this.network.networkId, chainId: this.network.chainId }; }
  async getBalance() { return BigInt(await rpc(this.network, "eth_getBalance", [address, "latest"])); }
  async nativeTransfer() { throw new Error("Transfers disabled: read-only smoke"); }
}
const timedFetch = (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
const api = new PublicVaultClient({ baseUrl: process.env.OMNI_VAULT_API_URL ?? "https://dev.omniterminal.app/vault-console/api", fetch: timedFetch });
const data = new OmniDataPlaneClient({ baseUrl: process.env.OMNI_DATA_URL ?? "https://omniterminal.app", fetch: timedFetch });
class OmniReadActions extends ActionProvider {
  constructor() { super("omni_read", []); }
  supportsNetwork(network) { return networks.some(n => n.chainId === network.chainId); }
  getActions() {
    return [{
      name: "omni_live_vault_and_market_data",
      description: "Read testnet vault configuration and Omni liquidation data; never sign or trade.",
      schema: z.object({ symbol: z.string().min(1) }),
      invoke: async ({ symbol }) => {
        const [config, list, risk] = await Promise.all([api.protocolConfig(), api.vaults(), data.liquidationStats("hyperliquid", symbol)]);
        assert.equal(config.network, "testnet");
        assert.equal(config.chain_id, 998);
        for (const field of ["builder_verifier_automatic", "admission_required"]) assert.equal(typeof config[field], "boolean");
        assert.equal(typeof config.minimum_deposit_assets, "number");
        assert.equal(typeof config.max_total_assets, "number");
        assert.ok(list.vaults.every(v => typeof v.archived === "boolean"));
        assert.equal(risk.data?.stats?.symbol ?? risk.symbol, symbol);
        assert.ok(risk.timestamp && risk.data?.stats);
        const dataAgeSeconds = (Date.now() - risk.timestamp) / 1000;
        assert.ok(dataAgeSeconds >= -30 && dataAgeSeconds < 300, "Omni liquidation data is stale");
        return JSON.stringify({ vaultNetwork: config.network, vaultChainId: config.chain_id,
          vaultCount: list.vaults.length, archivedCount: list.vaults.filter(v => v.archived).length,
          builderVerifierAutomatic: config.builder_verifier_automatic,
          market: symbol, dataTimestamp: risk.timestamp, dataAgeSeconds,
          totalPositions: risk.data.stats.total_positions,
          executionEnabled: false });
      },
    }];
  }
}
for (const network of networks) {
  const chainId = BigInt(await rpc(network, "eth_chainId"));
  assert.equal(chainId, BigInt(network.chainId));
  const block = await rpc(network, "eth_getBlockByNumber", ["latest", false]);
  assert.ok(block?.hash && block?.timestamp);
  const blockAgeSeconds = Math.floor(Date.now() / 1000) - Number(BigInt(block.timestamp));
  assert.ok(blockAgeSeconds >= -30 && blockAgeSeconds < 300, "RPC latest block is stale");
  const walletProvider = new ReadOnlyWallet(network);
  const agent = await AgentKit.from({ walletProvider, actionProviders: [new OmniReadActions()] });
  const actions = agent.getActions();
  assert.equal(actions.length, 1, "Unexpected action exposed");
  await assert.rejects(walletProvider.nativeTransfer(), /Transfers disabled/);
  const args = actions[0].schema.parse({ symbol: process.env.OMNI_SYMBOL ?? "BTC" });
  const result = JSON.parse(await actions[0].invoke(args));
  console.log(JSON.stringify({ agentkit: "0.10.4", network: network.networkId,
    chainId: network.chainId, blockNumber: block.number, blockAgeSeconds, ...result }));
}
