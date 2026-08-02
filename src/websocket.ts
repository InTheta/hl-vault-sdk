import type {
  ReconnectingVaultStreamOptions,
  VaultStreamController,
  VaultStreamOptions,
  VaultStreamStatus,
  VaultUserSubscription,
} from "./types.js";

const DEFAULT_SUBSCRIPTIONS: VaultUserSubscription[] = [
  { type: "webData3" },
  { type: "orderUpdates" },
  { type: "userFills", aggregateByTime: true },
];

/**
 * Subscribe directly to Hyperliquid using the vault contract address as `user`.
 * This is a read-only, low-latency path; authenticated writes still use the vault gateway.
 */
export function connectVaultUserStream(options: VaultStreamOptions): WebSocket {
  const createSocket = options.webSocketFactory ?? defaultWebSocketFactory;
  const socket = createSocket(options.url);
  const subscriptions = options.subscriptions ?? DEFAULT_SUBSCRIPTIONS;
  socket.addEventListener("open", (event) => {
    for (const subscription of subscriptions) {
      socket.send(JSON.stringify({
        method: "subscribe",
        subscription: { ...subscription, user: options.vault },
      }));
    }
    options.onOpen?.(event);
  });
  socket.addEventListener("message", (event) => {
    try {
      options.onMessage(JSON.parse(String(event.data)));
    } catch {
      options.onMessage(event.data);
    }
  });
  if (options.onError) socket.addEventListener("error", options.onError);
  if (options.onClose) socket.addEventListener("close", options.onClose);
  return socket;
}

/**
 * Maintain one vault-user socket and resubscribe after unexpected disconnects.
 * Call close() during strategy shutdown to prevent any further reconnect.
 */
export function createReconnectingVaultUserStream(
  options: ReconnectingVaultStreamOptions,
): VaultStreamController {
  const baseDelay = boundedDelay(options.reconnectDelayMs ?? 500);
  const maxDelay = Math.max(baseDelay, boundedDelay(options.maxReconnectDelayMs ?? 10_000));
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempt = 0;
  let stopped = false;
  let currentStatus: VaultStreamStatus = "connecting";

  const report = (next: VaultStreamStatus): void => {
    currentStatus = next;
    options.onStatus?.(next, reconnectAttempt);
  };
  const scheduleReconnect = (): void => {
    if (stopped || reconnectTimer) return;
    reconnectAttempt += 1;
    report("reconnecting");
    const delay = Math.min(maxDelay, baseDelay * 2 ** Math.max(0, reconnectAttempt - 1));
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };
  const connect = (): void => {
    if (stopped) return;
    report(reconnectAttempt > 0 ? "reconnecting" : "connecting");
    socket = connectVaultUserStream({
      ...options,
      onOpen: (event) => {
        reconnectAttempt = 0;
        report("open");
        options.onOpen?.(event);
      },
      onClose: (event) => {
        options.onClose?.(event);
        scheduleReconnect();
      },
    });
  };

  connect();
  return {
    close: () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      socket?.close();
      socket = null;
      report("closed");
    },
    currentSocket: () => socket,
    status: () => currentStatus,
  };
}

function defaultWebSocketFactory(url: string): WebSocket {
  if (typeof globalThis.WebSocket !== "function") {
    throw new Error("Provide webSocketFactory when WebSocket is not available globally");
  }
  return new globalThis.WebSocket(url);
}

function boundedDelay(value: number): number {
  if (!Number.isFinite(value)) return 500;
  return Math.max(0, Math.min(60_000, Math.trunc(value)));
}
