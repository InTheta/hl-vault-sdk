import os
import time

from hl_vault_sdk import LeaderTradingClient, local_account_signer

address, signer = local_account_signer(os.environ["HL_VAULT_LEADER_PRIVATE_KEY"])
with LeaderTradingClient(os.environ["HL_VAULT_GATEWAY_URL"]) as leader:
    leader.authorize_leader(address, signer)
    delegated = leader.delegate_agent(
        address,
        agent_id="example-sol-agent",
        scopes=["account_read", "orders_read", "orders_write", "orders_cancel"],
        allowed_markets=[os.getenv("MARKET", "SOL")],
        max_notional_usd=10,
        session_expires_at=int(time.time() * 1000) + 30 * 60_000,
        sign_message=signer,
    )
    # In production deliver this token directly to a secret manager. Never print it.
    with LeaderTradingClient(
        os.environ["HL_VAULT_GATEWAY_URL"], token=delegated["token"]
    ) as agent:
        account = agent.account()
        print({"vault": account["vault"], "agentSession": delegated["sessionId"]})
    print(leader.revoke_agent_session(delegated["sessionId"]))
