import type {
  LiquidationStatsSnapshot,
  NormalizedLiquidationLevel,
} from "./types.js";

/**
 * Normalize Omni liquidation buckets into explicit long/short price levels.
 * Malformed, zero-sized and non-finite buckets are ignored before ranking.
 */
export function extractLiquidationLevels(
  snapshot: LiquidationStatsSnapshot,
  limit = 20,
): NormalizedLiquidationLevel[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new Error("liquidation level limit must be an integer from 1 through 200");
  }
  const buckets = snapshot.data?.stats?.buckets ?? [];
  const levels: NormalizedLiquidationLevel[] = [];
  for (const bucket of buckets) {
    const price = finitePositive(bucket.price);
    if (price === null) continue;
    appendLevel(levels, price, "long", bucket.long_liq_size, bucket.long_count);
    appendLevel(levels, price, "short", bucket.short_liq_size, bucket.short_count);
  }
  return levels
    .sort((left, right) => right.notionalUsd - left.notionalUsd)
    .slice(0, limit);
}

function appendLevel(
  levels: NormalizedLiquidationLevel[],
  price: number,
  side: "long" | "short",
  rawSize: unknown,
  rawCount: unknown,
): void {
  const size = finitePositive(rawSize);
  if (size === null) return;
  const count = Number(rawCount);
  levels.push({
    price,
    side,
    size,
    notionalUsd: price * size,
    positionCount: Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0,
    source: "bucket",
  });
}

function finitePositive(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
