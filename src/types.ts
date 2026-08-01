export type Address = `0x${string}`;
export type Hex = `0x${string}`;
export type JsonObject = Record<string, unknown>;

export type ClientOptions = {
  baseUrl: string;
  token?: string | undefined;
  fetch?: typeof globalThis.fetch | undefined;
};

export type DataPlaneClientOptions = ClientOptions & {
  apiKey?: string | undefined;
};

export type PointsPreviewInput = {
  executed_volume_usd_e6: number | bigint;
  maker_volume_usd_e6: number | bigint;
  time_weighted_capital_usd_hours_e6: number | bigint;
  active_days: number;
  self_trade?: boolean;
  circular_funding?: boolean;
  linked_wallet_cluster?: boolean;
  rapid_deposit_withdrawal?: boolean;
};

export type PointsPreview = {
  eligible_volume_usd_e6: number;
  volume_points: number;
  maker_points: number;
  capital_points: number;
  total_points: number;
  daily_cap_points: number;
  flags: string[];
  provisional: true;
  token_entitlement: false;
};

export type PointsCarryoverInput = {
  testnet_points: number;
  identity_verified: boolean;
  anti_sybil_flags?: string[];
};

export type PointsCarryoverPreview = {
  source_network: "hyperliquid-testnet";
  destination_network: "hyperliquid-mainnet";
  source_points: number;
  carryover_bps: number;
  carryover_cap_points: number;
  carried_points: number;
  eligible: boolean;
  reason: string;
  provisional: true;
  token_entitlement: false;
};

export type ProtocolConfig = {
  network: "mainnet" | "testnet";
  chain_id: number;
  chain_name: string;
  rpc_url: string;
  explorer_url: string;
  asset_kind: "unknown" | "mock_usdc_testnet_only" | "linked_usdc";
  asset_address: Address | null;
  factory_address: Address | null;
  transactions_enabled: boolean;
  vault_creation_enabled: boolean;
  max_vaults_per_leader: number;
  asset_decimals: number;
  creation_fee_assets: number;
  minimum_leader_seed_assets: number;
  leader_commission_bps: number;
  minimum_leader_share_bps: number;
  deposit_lock_seconds: number;
  builder_fee_required: boolean;
  builder_fee_recipient: Address | null;
  required_builder_fee_decibps: number;
};

export type VaultSummary = {
  address: Address;
  leader: Address;
  name: string;
  symbol: string;
  description: string;
  created_block: number;
  tvl_usdc: string | null;
  follower_count: number | null;
  all_time_pnl_usdc: string | null;
  max_drawdown_bps: number | null;
  active_nav_assets: string | null;
  total_supply_shares: string | null;
  public_deposits_enabled: boolean | null;
  leader_share_bps: number | null;
  builder_fee_active: boolean | null;
  builder_fee_approval_requested: boolean | null;
  builder_fee_recipient: Address | null;
  builder_fee_decibps: number | null;
  reconciliation_status: string | null;
  contract_nav_authoritative: boolean;
  core_snapshot_at_ms: number | null;
  core_spot_usdc: string | null;
  core_default_perp_account_value: string | null;
  core_perp_dex_account_values: Record<string, string>;
  core_position_count: number | null;
  core_open_order_count: number | null;
};

export type PublicVaultList = {
  factory_address: Address | null;
  indexing_enabled: boolean;
  registry_snapshot_at: string | null;
  vaults: VaultSummary[];
};

export type VaultPerformancePoint = {
  observed_at: string;
  tvl_usdc: string;
  share_price_usdc: string;
  return_bps: number;
  drawdown_bps: number;
};

export type VaultPerformance = {
  address: Address;
  first_observed_at: string;
  latest_observed_at: string;
  observation_count: number;
  window_return_bps: number;
  max_drawdown_bps: number;
  points: VaultPerformancePoint[];
};

export type ExecutorCapabilities = {
  network: "testnet";
  vault: Address;
  leader: Address;
  agent: Address;
  builder: Address;
  builder_fee_decibps: number;
  max_notional_usd: number;
  allow_taker: boolean;
  allowed_markets: string[];
  allowed_assets: Record<string, string>;
  max_leverage: number;
  managed_twap_mode: string;
  managed_twap_maker_offset_bps: number;
  info_endpoint: string;
  exchange_endpoint: string;
  websocket_url: string;
  supported_exchange_actions: string[];
  blocked_exchange_actions: string[];
  authentication: string;
};

export type LeaderChallenge = {
  challengeId: string;
  message: string;
  expiresAt: number;
};

export type LeaderSession = {
  token: string;
  expiresAt: number;
  vault: Address;
  leader: Address;
};

export type AgentScope =
  | "account_read"
  | "orders_read"
  | "orders_write"
  | "orders_cancel"
  | "twaps_read";

export type AgentDelegationInput = {
  agentId: string;
  scopes: AgentScope[];
  allowedMarkets: string[];
  maxNotionalUsd: number;
  allowTaker?: boolean;
  sessionExpiresAt: number;
};

export type AgentChallenge = {
  challengeId: string;
  message: string;
  challengeExpiresAt: number;
  sessionExpiresAt: number;
};

export type AgentSession = {
  token: string;
  sessionId: string;
  expiresAt: number;
  vault: Address;
  agentId: string;
  scopes: AgentScope[];
  allowedMarkets: string[];
  maxNotionalUsd: number;
  allowTaker: boolean;
};

export type AgentRevokeResult = {
  revoked: boolean;
  sessionId: string;
};

export type SignMessage = (message: string) => Promise<Hex>;

export type OpenOrder = {
  coin?: string;
  side?: string;
  limitPx?: string;
  sz?: string;
  oid?: number;
  cloid?: string;
  [key: string]: unknown;
};

export type PerpPosition = {
  position?: {
    coin?: string;
    szi?: string;
    unrealizedPnl?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type ClearinghouseState = {
  marginSummary?: { accountValue?: string; [key: string]: unknown };
  withdrawable?: string;
  assetPositions?: PerpPosition[];
  [key: string]: unknown;
};

export type AccountSnapshot = {
  vault: Address;
  perps?: ClearinghouseState;
  perpDexs?: Record<string, ClearinghouseState>;
  spot?: {
    balances?: Array<{ coin?: string; total?: string; [key: string]: unknown }>;
    [key: string]: unknown;
  };
  openOrders?: OpenOrder[];
  fills?: unknown[];
  portfolio?: unknown[];
};

export type PlaceOrderInput = {
  market: string;
  side: "buy" | "sell";
  limit_px: number;
  size: number;
  reduce_only?: boolean;
  tif?: "Alo" | "Gtc" | "Ioc";
  client_order_id?: string;
};

export type PlaceOrderResult = {
  accepted: boolean;
  status: string;
  market: string;
  client_order_id: string;
  order_id?: number;
};

export type CancelOrderInput = {
  market: string;
  client_order_id: string;
};

export type X402ClientOptions = Omit<ClientOptions, "token">;

export type HlOrderWire = {
  a: number;
  b: boolean;
  p: string;
  s: string;
  r: boolean;
  t: { limit: { tif: "Alo" | "Gtc" | "Ioc" } };
  c?: string;
};

export type HlExchangeEnvelope<TAction extends JsonObject = JsonObject> = {
  action: TAction;
  nonce?: number;
  signature?: { r: string; s: string; v: number };
  vaultAddress?: Address;
  expiresAfter?: number;
};

export type HlExchangeResponse<TData = unknown> = {
  status: "ok" | "err";
  response: TData;
};

export type ManagedTwap = {
  twapId: number;
  status: "running" | "completed" | "cancelled" | "failed";
  executionMode: string;
  slicesTotal: number;
  slicesSubmitted: number;
  activeCloid: string | null;
  lastError: string | null;
  [key: string]: unknown;
};

export type ManagedTwapList = {
  engine: string;
  durable: boolean;
  twaps: ManagedTwap[];
};
