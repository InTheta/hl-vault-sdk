import os

from hl_vault_sdk import LeaderTradingClient, bounded_market_order

execute = os.getenv("EXECUTE") == "1"
market = os.getenv("MARKET", "SOL")
reference = float(os.environ["REFERENCE_PRICE"])
with LeaderTradingClient(
    os.environ["HL_VAULT_GATEWAY_URL"], token=os.environ["HL_VAULT_AGENT_TOKEN"]
) as trading:
    policy = trading.capabilities()
    if market not in policy["allowed_markets"]:
        raise RuntimeError(f"{market} is outside the signed/executor allowlist")
    order = bounded_market_order(
        market=market,
        side="buy",
        reference_price=reference,
        size=min(0.01, policy["max_notional_usd"] / reference),
        max_slippage_bps=25,
    )
    print(
        {"execute": execute, "vault": policy["vault"], "builder": policy["builder"], "order": order}
    )
    if execute:
        print(trading.place_order(**order))
