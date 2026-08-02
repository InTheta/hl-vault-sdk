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

export type OmniFreshness = {
  status?: "fresh" | "stale" | "degraded" | string;
  max_age_seconds?: number;
  [key: string]: unknown;
};

export type LiquidationBucket = {
  price: number;
  long_liq_size?: number;
  short_liq_size?: number;
  long_count?: number;
  short_count?: number;
  value_density?: number;
  bucket_size?: number;
  [key: string]: unknown;
};

export type LiquidationStatsSnapshot = {
  event_type?: string;
  exchange?: string;
  symbol?: string;
  timestamp?: number;
  data?: {
    stats?: {
      symbol?: string;
      coin?: string;
      scope?: "current" | "aggregate" | string;
      mid?: number;
      index_price?: number;
      total_size?: number;
      total_value?: number;
      total_positions?: number;
      buckets?: LiquidationBucket[];
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type NormalizedLiquidationLevel = {
  price: number;
  side: "long" | "short";
  size: number;
  notionalUsd: number;
  positionCount: number;
  source: "bucket";
};

export type MarketRiskSnapshot = {
  service: string;
  schema: string;
  symbol: string;
  data_as_of: string;
  freshness: OmniFreshness;
  liquidations?: Record<string, unknown>;
  news?: Record<string, unknown>;
  usage?: Record<string, unknown>;
  [key: string]: unknown;
};

export type MarketSnapshot = {
  service: string;
  schema: string;
  symbol: string;
  interval: string;
  scope: string;
  freshness: OmniFreshness;
  candles: Array<{
    open_time: number;
    close_time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    trades?: number;
  }>;
  liquidation_overlay?: Record<string, unknown> | null;
  usage?: Record<string, unknown>;
  [key: string]: unknown;
};

export type MarketInterval =
  | "1m"
  | "5m"
  | "15m"
  | "1h"
  | "2h"
  | "4h"
  | "8h"
  | "1d"
  | "3d"
  | "1w"
  | "1M";

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

export type TerminalIntegrationManifest = {
  schema: "https://omniterminal.app/schemas/hl-vault-terminal-integration/v1";
  release_stage: "testnet_preview" | "public_testnet" | "mainnet";
  network: {
    name: "mainnet" | "testnet";
    chain_id: number;
    rpc_url: string;
    explorer_url: string;
  };
  contracts: {
    asset: Address | null;
    asset_decimals: number;
    factory: Address | null;
    vault_abi: string;
    factory_abi: string;
  };
  public_api: {
    base_url: string | null;
    manifest_path: string;
    vaults_path: string;
    vault_path_template: string;
    performance_path_template: string;
    points_leaderboard_path: string;
    wallet_points_path_template: string;
  };
  hyperliquid: {
    api_url: string;
    websocket_url: string;
    user: string;
    direct_public_reads: boolean;
  };
  leader_execution: {
    gateway_url: string | null;
    authentication: string;
    session_storage: "memory_only";
    builder_fee_required: boolean;
    builder_fee_recipient: Address | null;
    builder_fee_decibps: number;
    caller_builder_override: false;
    browser_origins_require_registration: boolean;
  };
  follower_flow: {
    asynchronous: true;
    transactions_enabled: boolean;
    operations: string[];
    deposit_lock_seconds: number;
    entry_fee_bps: number;
    generic_withdrawal_fee_bps: number;
    positive_profit_share_bps: number;
  };
  sdk: {
    package: "@intheta/hl-vault-sdk";
    repository: string;
    minimum_version: string;
  };
  security: {
    custody: string;
    trading_tokens: string;
    funding_authority: false;
    mainnet_enabled: boolean;
    nav_authoritative: boolean;
  };
};

export type PointsLedgerEntry = {
  wallet: Address;
  vault: Address;
  roles: Array<"leader" | "follower" | string>;
  executed_volume_usd_e6: string;
  maker_volume_usd_e6: string;
  time_weighted_capital_usd_hours_e6: string;
  score: PointsPreview;
  identity_verified: boolean;
  anti_sybil_status: string;
};

export type PointsLeaderboard = {
  version: string;
  network: string;
  generated_at_ms: number;
  source: string;
  token_entitlement: false;
  entries: PointsLedgerEntry[];
};

export type WalletPoints = {
  wallet: Address;
  version: string;
  generated_at_ms: number;
  token_entitlement: false;
  entries: PointsLedgerEntry[];
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
  | "twaps_read"
  | "twaps_write";

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

export type PublicVaultAccountSnapshot = {
  vault: Address;
  perps: ClearinghouseState;
  perpDexs: Record<string, ClearinghouseState>;
  spot: AccountSnapshot["spot"];
  openOrders: OpenOrder[];
  portfolio: unknown[];
};

export type ContractWriteRequest = {
  address: Address;
  abi: readonly object[];
  functionName: string;
  args: readonly unknown[];
};

export type ContractReadRequest = ContractWriteRequest;

export type VaultTerminalClientOptions = {
  vaultApiUrl: string;
  hyperliquidApiUrl?: string | undefined;
  tradeGatewayUrl?: string | undefined;
  token?: string | undefined;
  fetch?: typeof globalThis.fetch | undefined;
};

export type VaultTerminalDashboard = {
  manifest: TerminalIntegrationManifest;
  vault: VaultSummary;
  performance: VaultPerformance;
  account: PublicVaultAccountSnapshot;
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

export type PlaceOrderBatchInput = {
  orders: PlaceOrderInput[];
};

export type PlaceOrderBatchResult = {
  accepted: boolean;
  orders: PlaceOrderResult[];
};

export type BoundedMarketOrderInput = {
  market: string;
  side: "buy" | "sell";
  referencePrice: number;
  size: number;
  maxSlippageBps: number;
  reduceOnly?: boolean;
  clientOrderId?: string;
};

export type ScaledOrderPlanInput = {
  market: string;
  side: "buy" | "sell";
  totalSize: number;
  startPrice: number;
  endPrice: number;
  levels: number;
  tif?: "Alo" | "Gtc";
  reduceOnly?: boolean;
};

export type BasketLeg = {
  market: string;
  side: "buy" | "sell";
  weight: number;
  referencePrice: number;
};

export type BasketOrderPlanInput = {
  totalNotionalUsd: number;
  maxSlippageBps: number;
  legs: BasketLeg[];
  reduceOnly?: boolean;
};

export type VaultUserSubscription =
  | { type: "webData3" }
  | { type: "clearinghouseState"; dex?: string }
  | { type: "openOrders"; dex?: string }
  | { type: "orderUpdates" }
  | { type: "userEvents" }
  | { type: "userFills"; aggregateByTime?: boolean }
  | { type: "userFundings" }
  | { type: "userNonFundingLedgerUpdates" };

export type VaultStreamOptions = {
  url: string;
  vault: Address;
  subscriptions?: VaultUserSubscription[];
  webSocketFactory?: (url: string) => WebSocket;
  onMessage: (message: unknown) => void;
  onOpen?: (event: Event) => void;
  onError?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
};

export type VaultStreamStatus = "connecting" | "open" | "reconnecting" | "closed";

export type ReconnectingVaultStreamOptions = VaultStreamOptions & {
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  onStatus?: (status: VaultStreamStatus, attempt: number) => void;
};

export type VaultStreamController = {
  close: () => void;
  currentSocket: () => WebSocket | null;
  status: () => VaultStreamStatus;
};

export type CancelOrderInput = {
  market: string;
  client_order_id: string;
};

export type CancelAllOrdersInput = {
  markets?: string[];
};

export type CancelAllOrderResult = {
  market: string;
  order_id: number;
  accepted: boolean;
  status: string;
};

export type CancelAllOrdersResult = {
  accepted: boolean;
  matched: number;
  cancelled: number;
  failed: number;
  managed_twaps_stopped: number;
  orders: CancelAllOrderResult[];
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
  status: "running" | "cancelling" | "completed" | "cancelled" | "failed";
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

export type StartManagedTwapInput = {
  market: string;
  side: "buy" | "sell";
  size: number;
  minutes: number;
  randomize?: boolean;
  reduce_only?: boolean;
};

export type ManagedTwapActionResult = {
  status: "ok" | "err";
  response: {
    type: "twapOrder" | "twapCancel";
    data: unknown;
  };
};
