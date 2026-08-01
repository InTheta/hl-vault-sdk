#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { LeaderTradingClient } from "./client.js";
import { buildBoundedMarketOrder, buildScaledOrders } from "./orders.js";

const baseUrl = process.env.HL_VAULT_EXECUTOR_URL?.trim();
const token = process.env.HL_VAULT_AGENT_TOKEN?.trim();
if (!baseUrl || !token) {
  console.error("HL_VAULT_EXECUTOR_URL and HL_VAULT_AGENT_TOKEN are required");
  process.exit(1);
}

const client = new LeaderTradingClient({ baseUrl, token });
const server = new McpServer({ name: "hl-vault-execution", version: "0.1.0" });

server.registerTool(
  "get_vault_capabilities",
  {
    description: "Read the configured vault, markets, builder fee, and global execution limits.",
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  () => result(() => client.capabilities()),
);

server.registerTool(
  "get_vault_account",
  {
    description: "Read balances, positions, PnL, fills, and portfolio state for the delegated vault.",
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  () => result(() => client.account()),
);

server.registerTool(
  "list_vault_open_orders",
  {
    description: "List current open orders for the delegated vault.",
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  () => result(() => client.openOrders()),
);

server.registerTool(
  "list_vault_twaps",
  {
    description: "List builder-tagged managed TWAP state for the delegated vault.",
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  () => result(() => client.managedTwaps()),
);

const orderSchema = {
  market: z.string().min(1).max(64),
  side: z.enum(["buy", "sell"]),
  limit_px: z.number().positive().finite(),
  size: z.number().positive().finite(),
  tif: z.enum(["Alo", "Gtc", "Ioc"]).default("Alo"),
  client_order_id: z.uuid().optional(),
};

server.registerTool(
  "place_vault_order",
  {
    description:
      "Place a builder-tagged vault order. The server intersects this request with the leader-signed agent policy.",
    inputSchema: { ...orderSchema, reduce_only: z.boolean().default(false) },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  (input) =>
    result(() => {
      const { client_order_id, ...order } = input;
      return client.placeOrder(client_order_id ? { ...order, client_order_id } : order);
    }),
);

server.registerTool(
  "place_vault_market_order",
  {
    description:
      "Place a bounded IOC market-style order. The explicit reference price and slippage cap prevent an unbounded market order.",
    inputSchema: {
      market: z.string().min(1).max(64),
      side: z.enum(["buy", "sell"]),
      reference_price: z.number().positive().finite(),
      size: z.number().positive().finite(),
      max_slippage_bps: z.number().int().min(1).max(2_000),
      reduce_only: z.boolean().default(false),
      client_order_id: z.uuid().optional(),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  (input) =>
    result(() =>
      client.placeOrder(buildBoundedMarketOrder({
        market: input.market,
        side: input.side,
        referencePrice: input.reference_price,
        size: input.size,
        maxSlippageBps: input.max_slippage_bps,
        reduceOnly: input.reduce_only,
        ...(input.client_order_id ? { clientOrderId: input.client_order_id } : {}),
      })),
    ),
);

server.registerTool(
  "place_vault_order_batch",
  {
    description:
      "Atomically submit up to 20 builder-tagged basket orders in one Hyperliquid action.",
    inputSchema: {
      orders: z.array(z.object({
        ...orderSchema,
        reduce_only: z.boolean().default(false),
      })).min(1).max(20),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  (input) => result(() => client.placeOrderBatch(input.orders.map((order) => {
    const { client_order_id, ...rest } = order;
    return client_order_id ? { ...rest, client_order_id } : rest;
  }))),
);

server.registerTool(
  "place_vault_scaled_orders",
  {
    description:
      "Build and submit an evenly sized price ladder as one builder-tagged batch.",
    inputSchema: {
      market: z.string().min(1).max(64),
      side: z.enum(["buy", "sell"]),
      total_size: z.number().positive().finite(),
      start_price: z.number().positive().finite(),
      end_price: z.number().positive().finite(),
      levels: z.number().int().min(2).max(20),
      tif: z.enum(["Alo", "Gtc"]).default("Alo"),
      reduce_only: z.boolean().default(false),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  (input) => result(() => client.placeOrderBatch(buildScaledOrders({
    market: input.market,
    side: input.side,
    totalSize: input.total_size,
    startPrice: input.start_price,
    endPrice: input.end_price,
    levels: input.levels,
    tif: input.tif,
    reduceOnly: input.reduce_only,
  }))),
);

server.registerTool(
  "close_vault_position",
  {
    description:
      "Submit a reduce-only builder-tagged order to close or reduce a vault position. Price, side, and size remain explicit.",
    inputSchema: orderSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  (input) =>
    result(() => {
      const { client_order_id, ...order } = input;
      return client.closePosition(client_order_id ? { ...order, client_order_id } : order);
    }),
);

server.registerTool(
  "cancel_vault_order",
  {
    description: "Cancel a vault order by its client order ID and market.",
    inputSchema: {
      market: z.string().min(1).max(64),
      client_order_id: z.uuid(),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  (input) => result(() => client.cancelOrder(input)),
);

async function result(operation: () => Promise<unknown>) {
  try {
    const value = await operation();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
      structuredContent: asObject(value),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vault execution request failed";
    return {
      isError: true,
      content: [{ type: "text" as const, text: message }],
    };
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("HL Vault delegated execution MCP server running on stdio");
