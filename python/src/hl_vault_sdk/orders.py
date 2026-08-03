from __future__ import annotations

from collections.abc import Sequence
from typing import Any


def bounded_market_order(
    *,
    market: str,
    side: str,
    reference_price: float,
    size: float,
    max_slippage_bps: float,
    reduce_only: bool = False,
) -> dict[str, Any]:
    """Build an IOC order with an explicit worst price; never an unbounded market order."""
    _side(side)
    _positive(reference_price, "reference_price")
    _positive(size, "size")
    if not 0 <= max_slippage_bps <= 1_000:
        raise ValueError("max_slippage_bps must be from 0 through 1000")
    direction = 1 if side == "buy" else -1
    limit_px = reference_price * (1 + direction * max_slippage_bps / 10_000)
    return {
        "market": _market(market),
        "side": side,
        "limit_px": limit_px,
        "size": size,
        "tif": "Ioc",
        "reduce_only": reduce_only,
    }


def scaled_orders(
    *,
    market: str,
    side: str,
    total_size: float,
    start_price: float,
    end_price: float,
    levels: int,
    tif: str = "Alo",
    reduce_only: bool = False,
) -> list[dict[str, Any]]:
    _side(side)
    _positive(total_size, "total_size")
    _positive(start_price, "start_price")
    _positive(end_price, "end_price")
    if not 2 <= levels <= 20:
        raise ValueError("levels must be from 2 through 20")
    if tif not in {"Alo", "Gtc"}:
        raise ValueError("scaled orders support Alo or Gtc")
    step = (end_price - start_price) / (levels - 1)
    size = total_size / levels
    return [
        {
            "market": _market(market),
            "side": side,
            "limit_px": start_price + step * index,
            "size": size,
            "tif": tif,
            "reduce_only": reduce_only,
        }
        for index in range(levels)
    ]


def basket_orders(
    *,
    total_notional_usd: float,
    max_slippage_bps: float,
    legs: Sequence[dict[str, Any]],
    reduce_only: bool = False,
) -> list[dict[str, Any]]:
    _positive(total_notional_usd, "total_notional_usd")
    if not legs or len(legs) > 20:
        raise ValueError("basket must contain 1 through 20 legs")
    weights = sum(float(leg.get("weight", 0)) for leg in legs)
    _positive(weights, "total basket weight")
    orders = []
    for leg in legs:
        price = float(leg["reference_price"])
        notional = total_notional_usd * float(leg["weight"]) / weights
        orders.append(
            bounded_market_order(
                market=str(leg["market"]),
                side=str(leg["side"]),
                reference_price=price,
                size=notional / price,
                max_slippage_bps=max_slippage_bps,
                reduce_only=reduce_only,
            )
        )
    return orders


def _market(value: str) -> str:
    if not value.strip():
        raise ValueError("market is required")
    return value


def _side(value: str) -> None:
    if value not in {"buy", "sell"}:
        raise ValueError("side must be buy or sell")


def _positive(value: float, label: str) -> None:
    if value <= 0:
        raise ValueError(f"{label} must be positive")
