import type {
  AccountSnapshot,
  Address,
  AgentChallenge,
  AgentDelegationInput,
  AgentRevokeResult,
  AgentSession,
  CancelAllOrdersInput,
  CancelAllOrdersResult,
  CancelOrderInput,
  ClearinghouseState,
  ClientOptions,
  DataPlaneClientOptions,
  ExecutorCapabilities,
  HlExchangeEnvelope,
  HlExchangeResponse,
  JsonObject,
  LeaderChallenge,
  LeaderSession,
  LiquidationStatsSnapshot,
  ManagedTwapList,
  ManagedTwapActionResult,
  MarketInterval,
  MarketRiskSnapshot,
  MarketSnapshot,
  PlaceOrderInput,
  PlaceOrderBatchResult,
  PlaceOrderResult,
  PointsCarryoverInput,
  PointsCarryoverPreview,
  PointsPreview,
  PointsPreviewInput,
  PointsLeaderboard,
  ProtocolConfig,
  PublicVaultList,
  PublicVaultAccountSnapshot,
  SignMessage,
  StartManagedTwapInput,
  VaultPerformance,
  VaultSummary,
  TerminalIntegrationManifest,
  WalletPoints,
  X402ClientOptions,
} from "./types.js";

export class VaultApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(errorMessage(status, body));
    this.name = "VaultApiError";
    this.status = status;
    this.body = body;
  }
}

class HttpClient {
  protected readonly baseUrl: string;
  private readonly fetcher: typeof globalThis.fetch;

  constructor(options: ClientOptions) {
    if (!options.baseUrl.trim()) throw new Error("baseUrl is required");
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetcher = options.fetch ?? globalThis.fetch;
    if (!this.fetcher) throw new Error("A Fetch API implementation is required");
  }

  protected async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, init);
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new VaultApiError(response.status, body);
    return body as T;
  }
}

export class PublicVaultClient extends HttpClient {
  integrationManifest(): Promise<TerminalIntegrationManifest> {
    return this.request("/v1/integration/manifest");
  }

  protocolConfig(): Promise<ProtocolConfig> {
    return this.request("/v1/protocol/config");
  }

  vaults(): Promise<PublicVaultList> {
    return this.request("/v1/vaults");
  }

  vault(address: Address): Promise<VaultSummary> {
    return this.request(`/v1/vaults/${encodeURIComponent(address)}`);
  }

  performance(address: Address, limit = 288): Promise<VaultPerformance> {
    if (!Number.isInteger(limit) || limit < 2 || limit > 1_000) {
      throw new Error("performance limit must be an integer from 2 through 1000");
    }
    return this.request(
      `/v1/vaults/${encodeURIComponent(address)}/performance?limit=${limit}`,
    );
  }

  pointsPreview(input: PointsPreviewInput): Promise<PointsPreview> {
    return this.request("/v1/points/preview", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(input, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    });
  }

  pointsCarryoverPreview(input: PointsCarryoverInput): Promise<PointsCarryoverPreview> {
    return this.request("/v1/points/testnet-carryover-preview", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    });
  }

  pointsLeaderboard(): Promise<PointsLeaderboard> {
    return this.request("/v1/points/leaderboard");
  }

  walletPoints(address: Address): Promise<WalletPoints> {
    assertAddress(address, "wallet");
    return this.request(`/v1/points/wallet/${encodeURIComponent(address)}`);
  }
}

/** Direct, unauthenticated Hyperliquid reads scoped to a vault account address. */
export class HyperliquidVaultReadClient extends HttpClient {
  clearinghouseState(vault: Address, dex?: string): Promise<ClearinghouseState> {
    return this.info({ type: "clearinghouseState", user: vault, ...(dex ? { dex } : {}) });
  }

  spotClearinghouseState<T = AccountSnapshot["spot"]>(vault: Address): Promise<T> {
    return this.info({ type: "spotClearinghouseState", user: vault });
  }

  openOrders<T = AccountSnapshot["openOrders"]>(vault: Address, dex?: string): Promise<T> {
    return this.info({ type: "openOrders", user: vault, ...(dex ? { dex } : {}) });
  }

  portfolio<T = unknown[]>(vault: Address): Promise<T> {
    return this.info({ type: "portfolio", user: vault });
  }

  async account(vault: Address, dexes: string[] = []): Promise<PublicVaultAccountSnapshot> {
    assertAddress(vault, "vault");
    const [perps, spot, openOrders, portfolio, dexStates] = await Promise.all([
      this.clearinghouseState(vault),
      this.spotClearinghouseState(vault),
      this.openOrders(vault),
      this.portfolio(vault),
      Promise.all(dexes.map(async (dex) => [dex, await this.clearinghouseState(vault, dex)] as const)),
    ]);
    return {
      vault,
      perps: perps ?? {},
      spot: spot ?? {},
      openOrders: Array.isArray(openOrders) ? openOrders : [],
      portfolio: Array.isArray(portfolio) ? portfolio : [],
      perpDexs: Object.fromEntries(dexStates),
    };
  }

  private info<T>(body: JsonObject): Promise<T> {
    return this.request("/info", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    });
  }
}

/** Read-only client for the public Omni node/data plane used by vault leaders. */
export class OmniDataPlaneClient extends HttpClient {
  private readonly apiKey: string | undefined;

  constructor(options: DataPlaneClientOptions) {
    super(options);
    this.apiKey = options.apiKey;
  }

  news<T = unknown>(symbol?: string, limit = 20): Promise<T> {
    const suffix = symbol ? `/${encodeURIComponent(symbol)}` : "";
    return this.dataRequest(`/api/terminal/news${suffix}?limit=${bounded(limit, 1, 200)}`);
  }

  liquidationStats<T = LiquidationStatsSnapshot>(
    exchange: string,
    symbol: string,
    scope: "current" | "aggregate" = "current",
  ): Promise<T> {
    return this.dataRequest(
      `/api/terminal/liquidation-stats/${encodeURIComponent(exchange)}/${encodeURIComponent(symbol)}?scope=${scope}`,
    );
  }

  orderbook<T = unknown>(symbol: string, depth = 20): Promise<T> {
    return this.dataRequest(
      `/api/terminal/orderbook?symbol=${encodeURIComponent(symbol)}&depth=${bounded(depth, 1, 1_000)}`,
    );
  }

  marginStress<T = unknown>(limit = 24): Promise<T> {
    return this.dataRequest(`/api/terminal/margin-stress?limit=${bounded(limit, 1, 200)}`);
  }

  private dataRequest<T>(path: string): Promise<T> {
    return this.request(path, {
      headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
    });
  }
}

/**
 * Paid Omni intelligence client. Pass a payment-enabled Fetch implementation
 * (for example @x402/fetch's wrapper); this SDK never accepts or stores a payer key.
 */
export class OmniX402Client extends HttpClient {
  constructor(options: X402ClientOptions) {
    super(options);
  }

  health<T = unknown>(): Promise<T> {
    return this.request("/api/x402/v1/news/health");
  }

  marketRisk<T = MarketRiskSnapshot>(
    symbol: string,
    eventWindowMinutes: 15 | 60 = 60,
    limit = 5,
  ): Promise<T> {
    return this.request(
      `/api/x402/v1/market-risk/${encodeURIComponent(symbol)}?scope=current&event_window_minutes=${eventWindowMinutes}&limit=${bounded(limit, 1, 10)}`,
    );
  }

  marketSnapshot<T = MarketSnapshot>(
    symbol: string,
    interval: MarketInterval = "1h",
    limit = 120,
  ): Promise<T> {
    return this.request(
      `/api/x402/v1/market-snapshot/${encodeURIComponent(symbol)}?interval=${encodeURIComponent(interval)}&limit=${bounded(limit, 20, 200)}&scope=aggregate&include_liquidations=true`,
    );
  }

  marketCarry<T = unknown>(symbol: string): Promise<T> {
    return this.request(`/api/x402/v1/market-carry/${encodeURIComponent(symbol)}`);
  }

  mcp<T = unknown>(message: JsonObject): Promise<T> {
    return this.request("/api/x402/mcp", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(message),
    });
  }
}

export class LeaderTradingClient extends HttpClient {
  private token: string | undefined;

  constructor(options: ClientOptions) {
    super(options);
    this.token = options.token;
  }

  capabilities(): Promise<ExecutorCapabilities> {
    return this.request("/v1/capabilities");
  }

  async authorizeLeader(address: Address, signMessage: SignMessage): Promise<LeaderSession> {
    const challenge = await this.request<LeaderChallenge>("/v1/auth/challenge", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ address }),
    });
    if (challenge.expiresAt <= Date.now()) throw new Error("Leader challenge expired");
    const signature = await signMessage(challenge.message);
    const session = await this.request<LeaderSession>("/v1/auth/session", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ challengeId: challenge.challengeId, signature }),
    });
    this.token = session.token;
    return session;
  }

  async delegateAgent(
    address: Address,
    delegation: AgentDelegationInput,
    signMessage: SignMessage,
  ): Promise<AgentSession> {
    validateAgentDelegation(delegation);
    const challenge = await this.request<AgentChallenge>("/v1/auth/agent-challenge", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ address, ...delegation, allowTaker: delegation.allowTaker ?? false }),
    });
    if (challenge.challengeExpiresAt <= Date.now()) {
      throw new Error("Agent delegation challenge expired");
    }
    const signature = await signMessage(challenge.message);
    return this.request<AgentSession>("/v1/auth/agent-session", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ challengeId: challenge.challengeId, signature }),
    });
  }

  revokeAgentSession(sessionId: string): Promise<AgentRevokeResult> {
    if (!sessionId) throw new Error("sessionId is required");
    return this.authenticated("/v1/auth/agent-revoke", { sessionId });
  }

  setToken(token: string): void {
    if (!token) throw new Error("token is required");
    this.token = token;
  }

  clearToken(): void {
    this.token = undefined;
  }

  account<T extends AccountSnapshot = AccountSnapshot>(): Promise<T> {
    return this.authenticated("/v1/account");
  }

  openOrders<T = unknown[]>(): Promise<T> {
    return this.authenticated("/v1/open-orders");
  }

  info<T = unknown>(request: JsonObject): Promise<T> {
    return this.authenticated("/info", request);
  }

  exchange<T = unknown, TAction extends JsonObject = JsonObject>(
    envelope: HlExchangeEnvelope<TAction>,
  ): Promise<HlExchangeResponse<T>> {
    return this.authenticated("/exchange", envelope);
  }

  placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
    return this.authenticated("/v1/orders", {
      ...input,
      reduce_only: input.reduce_only ?? false,
      tif: input.tif ?? "Alo",
      client_order_id: input.client_order_id ?? randomUuid(),
    });
  }

  placeOrderBatch(orders: PlaceOrderInput[]): Promise<PlaceOrderBatchResult> {
    if (orders.length < 1 || orders.length > 20) {
      throw new Error("order batch must contain 1 through 20 orders");
    }
    return this.authenticated("/v1/orders/batch", {
      orders: orders.map((order) => ({
        ...order,
        client_order_id: order.client_order_id ?? randomUuid(),
      })),
    });
  }

  cancelOrder(input: CancelOrderInput): Promise<unknown> {
    if (!input.client_order_id) throw new Error("client_order_id is required");
    return this.authenticated("/v1/cancels", input);
  }

  cancelAllOrders(input: CancelAllOrdersInput = {}): Promise<CancelAllOrdersResult> {
    const markets = input.markets ?? [];
    if (markets.length > 100) throw new Error("cancel-all supports at most 100 market filters");
    if (markets.some((market) => !market.trim())) {
      throw new Error("cancel-all market filters cannot be empty");
    }
    return this.authenticated("/v1/cancels/all", { markets });
  }

  closePosition(input: Omit<PlaceOrderInput, "reduce_only">): Promise<PlaceOrderResult> {
    return this.placeOrder({ ...input, reduce_only: true });
  }

  managedTwaps(): Promise<ManagedTwapList> {
    return this.authenticated("/v1/twaps");
  }

  startManagedTwap(input: StartManagedTwapInput): Promise<ManagedTwapActionResult> {
    if (!input.market.trim()) throw new Error("TWAP market is required");
    if (!Number.isFinite(input.size) || input.size <= 0) {
      throw new Error("TWAP size must be positive");
    }
    if (!Number.isInteger(input.minutes) || input.minutes < 5 || input.minutes > 1_440) {
      throw new Error("TWAP minutes must be an integer from 5 through 1440");
    }
    return this.authenticated("/v1/twaps", {
      ...input,
      randomize: input.randomize ?? true,
      reduce_only: input.reduce_only ?? false,
    });
  }

  cancelManagedTwap(twapId: number): Promise<ManagedTwapActionResult> {
    if (!Number.isSafeInteger(twapId) || twapId <= 0) {
      throw new Error("twapId must be a positive safe integer");
    }
    return this.authenticated("/v1/twaps/cancel", { twap_id: twapId });
  }

  private authenticated<T>(path: string, body?: unknown): Promise<T> {
    if (!this.token) throw new Error("Leader authentication token is required");
    return this.request(path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...jsonHeaders(),
        Authorization: `Bearer ${this.token}`,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
}

function validateAgentDelegation(input: AgentDelegationInput): void {
  if (!/^[A-Za-z0-9._-]{3,64}$/.test(input.agentId)) {
    throw new Error("agentId must be 3..64 letters, digits, dots, dashes, or underscores");
  }
  if (input.scopes.length === 0) throw new Error("At least one agent scope is required");
  if (input.allowedMarkets.length === 0) {
    throw new Error("At least one allowed market is required");
  }
  if (!Number.isFinite(input.maxNotionalUsd) || input.maxNotionalUsd <= 0) {
    throw new Error("maxNotionalUsd must be positive");
  }
  const remaining = input.sessionExpiresAt - Date.now();
  if (remaining <= 0 || remaining > 60 * 60 * 1_000) {
    throw new Error("sessionExpiresAt must be in the future and no more than 60 minutes away");
  }
}

function jsonHeaders(): Record<string, string> {
  return { "Content-Type": "application/json" };
}

function bounded(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function errorMessage(status: number, body: unknown): string {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (typeof error === "string") return error;
  }
  return `Vault API returned HTTP ${status}`;
}

function randomUuid(): string {
  const value = globalThis.crypto?.randomUUID?.();
  if (!value) throw new Error("crypto.randomUUID is required to create a safe client order ID");
  return value;
}

function assertAddress(value: string, label: string): void {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${label} must be a 20-byte 0x-prefixed address`);
  }
}
