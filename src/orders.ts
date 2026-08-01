import type {
  BasketOrderPlanInput,
  BoundedMarketOrderInput,
  PlaceOrderInput,
  ScaledOrderPlanInput,
} from "./types.js";

export function buildBoundedMarketOrder(input: BoundedMarketOrderInput): PlaceOrderInput {
  positive(input.referencePrice, "referencePrice");
  positive(input.size, "size");
  boundedInteger(input.maxSlippageBps, 1, 2_000, "maxSlippageBps");
  const multiplier = input.side === "buy"
    ? 1 + input.maxSlippageBps / 10_000
    : 1 - input.maxSlippageBps / 10_000;
  const order: PlaceOrderInput = {
    market: input.market,
    side: input.side,
    limit_px: input.referencePrice * multiplier,
    size: input.size,
    reduce_only: input.reduceOnly ?? false,
    tif: "Ioc",
  };
  if (input.clientOrderId) order.client_order_id = input.clientOrderId;
  return order;
}

export function buildScaledOrders(input: ScaledOrderPlanInput): PlaceOrderInput[] {
  positive(input.totalSize, "totalSize");
  positive(input.startPrice, "startPrice");
  positive(input.endPrice, "endPrice");
  boundedInteger(input.levels, 2, 20, "levels");
  const levelSize = input.totalSize / input.levels;
  return Array.from({ length: input.levels }, (_unused, index) => ({
    market: input.market,
    side: input.side,
    limit_px:
      input.startPrice + ((input.endPrice - input.startPrice) * index) / (input.levels - 1),
    size: levelSize,
    reduce_only: input.reduceOnly ?? false,
    tif: input.tif ?? "Alo",
  }));
}

export function buildBasketOrders(input: BasketOrderPlanInput): PlaceOrderInput[] {
  positive(input.totalNotionalUsd, "totalNotionalUsd");
  boundedInteger(input.maxSlippageBps, 1, 2_000, "maxSlippageBps");
  if (input.legs.length < 1 || input.legs.length > 20) {
    throw new Error("basket must contain 1 through 20 legs");
  }
  const weightTotal = input.legs.reduce((total, leg) => {
    positive(leg.weight, "leg.weight");
    positive(leg.referencePrice, "leg.referencePrice");
    return total + leg.weight;
  }, 0);
  return input.legs.map((leg) =>
    buildBoundedMarketOrder({
      market: leg.market,
      side: leg.side,
      referencePrice: leg.referencePrice,
      size: (input.totalNotionalUsd * leg.weight) / weightTotal / leg.referencePrice,
      maxSlippageBps: input.maxSlippageBps,
      ...(input.reduceOnly === undefined ? {} : { reduceOnly: input.reduceOnly }),
    }),
  );
}

function positive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be finite and positive`);
}

function boundedInteger(value: number, min: number, max: number, name: string): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} through ${max}`);
  }
}
