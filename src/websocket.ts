import type { VaultStreamOptions, VaultUserSubscription } from "./types.js";

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
  socket.addEventListener("open", () => {
    for (const subscription of subscriptions) {
      socket.send(JSON.stringify({
        method: "subscribe",
        subscription: { ...subscription, user: options.vault },
      }));
    }
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

function defaultWebSocketFactory(url: string): WebSocket {
  if (typeof globalThis.WebSocket !== "function") {
    throw new Error("Provide webSocketFactory when WebSocket is not available globally");
  }
  return new globalThis.WebSocket(url);
}
