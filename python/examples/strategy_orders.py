import os

from hl_vault_sdk import LeaderTradingClient, basket_orders, scaled_orders

execute = os.getenv("EXECUTE") == "1"
with LeaderTradingClient(
    os.environ["HL_VAULT_GATEWAY_URL"], token=os.environ["HL_VAULT_AGENT_TOKEN"]
) as trading:
    ladder = scaled_orders(
        market="SOL",
        side="buy",
        total_size=0.03,
        start_price=95,
        end_price=99,
        levels=3,
    )
    basket = basket_orders(
        total_notional_usd=10,
        max_slippage_bps=25,
        legs=[
            {"market": "BTC", "side": "buy", "weight": 2, "reference_price": 100_000},
            {"market": "SOL", "side": "buy", "weight": 1, "reference_price": 150},
        ],
    )
    print({"execute": execute, "ladder": ladder, "basket": basket})
    if execute:
        print({"ladder": trading.place_order_batch(ladder)})
        print({"basket": trading.place_order_batch(basket)})

    # TWAP has its own signed scope. It is previewed here and remains disabled
    # unless both the agent grant and executor policy allow it.
    twap = {"market": "SOL", "side": "buy", "size": 0.05, "minutes": 5}
    print({"executeTwap": execute and os.getenv("EXECUTE_TWAP") == "1", "twap": twap})
    if execute and os.getenv("EXECUTE_TWAP") == "1":
        print(trading.start_managed_twap(**twap))
