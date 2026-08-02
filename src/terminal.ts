import { asyncHyperVaultAbi, erc20Abi } from "./abis.js";
import {
  HyperliquidVaultReadClient,
  LeaderTradingClient,
  PublicVaultClient,
} from "./client.js";
import { createReconnectingVaultUserStream } from "./websocket.js";
import type {
  Address,
  ContractReadRequest,
  ContractWriteRequest,
  ReconnectingVaultStreamOptions,
  TerminalIntegrationManifest,
  VaultStreamController,
  VaultTerminalClientOptions,
  VaultTerminalDashboard,
} from "./types.js";

/** One discovery entry point for embedding vaults in another trading terminal. */
export class VaultTerminalClient {
  readonly manifest: TerminalIntegrationManifest;
  readonly public: PublicVaultClient;
  readonly hyperliquid: HyperliquidVaultReadClient;
  readonly trading: LeaderTradingClient | null;

  private constructor(
    options: VaultTerminalClientOptions,
    manifest: TerminalIntegrationManifest,
    publicClient: PublicVaultClient,
  ) {
    this.manifest = manifest;
    this.public = publicClient;
    this.hyperliquid = new HyperliquidVaultReadClient({
      baseUrl: options.hyperliquidApiUrl ?? manifest.hyperliquid.api_url,
      fetch: options.fetch,
    });
    const gateway = options.tradeGatewayUrl ?? manifest.leader_execution.gateway_url ?? undefined;
    this.trading = gateway
      ? new LeaderTradingClient({ baseUrl: gateway, token: options.token, fetch: options.fetch })
      : null;
  }

  static async connect(options: VaultTerminalClientOptions): Promise<VaultTerminalClient> {
    const publicClient = new PublicVaultClient({
      baseUrl: options.vaultApiUrl,
      fetch: options.fetch,
    });
    const manifest = await publicClient.integrationManifest();
    if (!manifest.schema.endsWith("/hl-vault-terminal-integration/v1")) {
      throw new Error(`Unsupported vault integration manifest: ${manifest.schema}`);
    }
    return new VaultTerminalClient(options, manifest, publicClient);
  }

  async dashboard(vault: Address, performanceLimit = 288): Promise<VaultTerminalDashboard> {
    const [summary, performance, account] = await Promise.all([
      this.public.vault(vault),
      this.public.performance(vault, performanceLimit),
      this.hyperliquid.account(vault),
    ]);
    return { manifest: this.manifest, vault: summary, performance, account };
  }

  requireTrading(): LeaderTradingClient {
    if (!this.trading) {
      throw new Error("This manifest does not advertise a public leader execution gateway");
    }
    return this.trading;
  }

  stream(
    vault: Address,
    options: Omit<ReconnectingVaultStreamOptions, "url" | "vault">,
  ): VaultStreamController {
    return createReconnectingVaultUserStream({
      ...options,
      url: this.manifest.hyperliquid.websocket_url,
      vault,
    });
  }
}

export function buildDepositTransactions(input: {
  asset: Address;
  vault: Address;
  assets: bigint;
}): [ContractWriteRequest, ContractWriteRequest] {
  positive(input.assets, "assets");
  return [
    write(input.asset, erc20Abi, "approve", [input.vault, input.assets]),
    write(input.vault, asyncHyperVaultAbi, "requestDeposit", [input.assets]),
  ];
}

/** Batch these public reads through the terminal's existing viem/ethers RPC client. */
export function buildFollowerReadRequests(
  vault: Address,
  wallet: Address,
): ContractReadRequest[] {
  validateAddress(vault, "vault");
  validateAddress(wallet, "wallet");
  return [
    write(vault, asyncHyperVaultAbi, "balanceOf", [wallet]),
    write(vault, asyncHyperVaultAbi, "depositRequests", [wallet]),
    write(vault, asyncHyperVaultAbi, "redeemRequests", [wallet]),
    write(vault, asyncHyperVaultAbi, "costBasisAssets", [wallet]),
    write(vault, asyncHyperVaultAbi, "lockupUntil", [wallet]),
    write(vault, asyncHyperVaultAbi, "currentEpoch", []),
  ];
}

export function buildClaimDepositTransaction(vault: Address): ContractWriteRequest {
  return write(vault, asyncHyperVaultAbi, "claimDeposit", []);
}

export function buildRedeemTransaction(vault: Address, shares: bigint): ContractWriteRequest {
  positive(shares, "shares");
  return write(vault, asyncHyperVaultAbi, "requestRedeem", [shares]);
}

export function buildClaimRedeemTransaction(vault: Address): ContractWriteRequest {
  return write(vault, asyncHyperVaultAbi, "claimRedeem", []);
}

export function buildCancelDepositTransaction(vault: Address): ContractWriteRequest {
  return write(vault, asyncHyperVaultAbi, "cancelDepositRequest", []);
}

export function buildCancelRedeemTransaction(vault: Address): ContractWriteRequest {
  return write(vault, asyncHyperVaultAbi, "cancelRedeemRequest", []);
}

function write(
  address: Address,
  abi: readonly object[],
  functionName: string,
  args: readonly unknown[],
): ContractWriteRequest {
  validateAddress(address, "contract");
  return { address, abi, functionName, args };
}

function positive(value: bigint, label: string): void {
  if (value <= 0n) throw new Error(`${label} must be positive`);
}

function validateAddress(value: string, label: string): void {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${label} must be a 20-byte 0x-prefixed address`);
  }
}
