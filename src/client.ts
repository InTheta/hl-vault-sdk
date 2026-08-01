import type {
  AccountSnapshot,
  Address,
  CancelOrderInput,
  ClientOptions,
  ExecutorCapabilities,
  HlExchangeEnvelope,
  HlExchangeResponse,
  JsonObject,
  LeaderChallenge,
  LeaderSession,
  ManagedTwapList,
  PlaceOrderInput,
  PlaceOrderResult,
  ProtocolConfig,
  PublicVaultList,
  SignMessage,
  VaultPerformance,
  VaultSummary,
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
    });
  }

  cancelOrder(input: CancelOrderInput): Promise<unknown> {
    if ((input.client_order_id === undefined) === (input.order_id === undefined)) {
      throw new Error("Provide exactly one of client_order_id or order_id");
    }
    return this.authenticated("/v1/cancels", input);
  }

  managedTwaps(): Promise<ManagedTwapList> {
    return this.authenticated("/v1/twaps");
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

function jsonHeaders(): Record<string, string> {
  return { "Content-Type": "application/json" };
}

function errorMessage(status: number, body: unknown): string {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (typeof error === "string") return error;
  }
  return `Vault API returned HTTP ${status}`;
}
