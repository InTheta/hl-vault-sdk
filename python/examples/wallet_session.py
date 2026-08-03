import os

from hl_vault_sdk import LeaderTradingClient, bounded_market_order, local_account_signer

gateway = os.environ["HL_VAULT_GATEWAY_URL"]
address, signer = local_account_signer(os.environ["HL_VAULT_LEADER_PRIVATE_KEY"])
with LeaderTradingClient(gateway) as trading:
    session = trading.authorize_leader(address, signer)
    policy = trading.capabilities()
    print({"leader": address, "vault": session["vault"], "expiresAt": session["expiresAt"]})
    print({"markets": policy["allowed_markets"], "builder": policy["builder"]})
    order = bounded_market_order(
        market=os.getenv("MARKET", policy["allowed_markets"][0]),
        side="buy",
        reference_price=float(os.environ["REFERENCE_PRICE"]),
        size=0.01,
        max_slippage_bps=25,
    )
    print({"execute": os.getenv("EXECUTE") == "1", "order": order})
    if os.getenv("EXECUTE") == "1":
        print(trading.place_order(**order))
