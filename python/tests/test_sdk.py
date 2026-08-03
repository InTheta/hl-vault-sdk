from __future__ import annotations

import json
import time
from typing import Any

import httpx
import pytest
from eth_account import Account
from eth_account.messages import encode_defunct

from hl_vault_sdk import (
    LeaderTradingClient,
    OmniX402Client,
    PublicVaultClient,
    VaultApiError,
    basket_orders,
    bounded_market_order,
    build_deposit_calls,
    build_follower_read_calls,
    local_account_signer,
    scaled_orders,
    subscription_messages,
)

LEADER = "0x1111111111111111111111111111111111111111"
VAULT = "0x2222222222222222222222222222222222222222"
ASSET = "0x3333333333333333333333333333333333333333"


def client(handler: Any) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_public_reads_headers_and_error() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.url.path.endswith(VAULT):
            return httpx.Response(404, json={"error": "vault not found"})
        return httpx.Response(200, json={"vaults": []})

    api = PublicVaultClient(
        "https://vault.example",
        headers={"CF-Access-Client-Id": "terminal"},
        client=client(handler),
    )
    assert api.vaults() == {"vaults": []}
    assert seen[0].headers["CF-Access-Client-Id"] == "terminal"
    with pytest.raises(VaultApiError, match="vault not found") as error:
        api.vault(VAULT)
    assert error.value.status == 404


def test_wallet_challenge_signing_and_authenticated_order() -> None:
    account = Account.create()
    address, signer = local_account_signer(account.key.hex())
    captured: list[dict[str, Any]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content) if request.content else None
        captured.append({"path": request.url.path, "headers": request.headers, "body": body})
        if request.url.path.endswith("/auth/challenge"):
            return httpx.Response(
                200,
                json={
                    "challengeId": "challenge-1",
                    "message": "Sign this exact vault challenge",
                    "expiresAt": int(time.time() * 1000) + 60_000,
                },
            )
        if request.url.path.endswith("/auth/session"):
            recovered = Account.recover_message(
                encode_defunct(text="Sign this exact vault challenge"),
                signature=body["signature"],
            )
            assert recovered.lower() == address.lower()
            return httpx.Response(
                200,
                json={"token": "short-session", "vault": VAULT, "leader": address},
            )
        return httpx.Response(
            200,
            json={"accepted": True, "status": "resting", "market": "SOL"},
        )

    trading = LeaderTradingClient(
        "https://trade.example",
        headers={"CF-Access-Client-Id": "terminal"},
        client=client(handler),
    )
    trading.authorize_leader(address, signer)
    trading.place_order(market="SOL", side="buy", limit_px=100, size=0.1)
    assert captured[2]["headers"]["authorization"] == "Bearer short-session"
    assert captured[2]["headers"]["cf-access-client-id"] == "terminal"
    assert len(captured[2]["body"]["client_order_id"]) == 36


def test_agent_delegation_binds_scope_and_can_be_revoked() -> None:
    account = Account.create()
    address, signer = local_account_signer(account.key.hex())
    requests: list[dict[str, Any]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content) if request.content else None
        requests.append({"path": request.url.path, "body": body})
        if request.url.path.endswith("agent-challenge"):
            return httpx.Response(
                200,
                json={
                    "challengeId": "agent-challenge",
                    "message": "bounded agent",
                    "challengeExpiresAt": int(time.time() * 1000) + 30_000,
                },
            )
        if request.url.path.endswith("agent-session"):
            return httpx.Response(200, json={"token": "agent", "sessionId": "session-1"})
        return httpx.Response(200, json={"revoked": True, "sessionId": "session-1"})

    trading = LeaderTradingClient(
        "https://trade.example", token="leader-session", client=client(handler)
    )
    session = trading.delegate_agent(
        address,
        agent_id="risk-bot-1",
        scopes=["account_read", "orders_write"],
        allowed_markets=["SOL"],
        max_notional_usd=10,
        session_expires_at=int(time.time() * 1000) + 600_000,
        sign_message=signer,
    )
    assert session["sessionId"] == "session-1"
    assert requests[0]["body"]["maxNotionalUsd"] == 10
    assert requests[0]["body"]["allowedMarkets"] == ["SOL"]
    assert trading.revoke_agent_session("session-1")["revoked"] is True


def test_order_plans_are_bounded() -> None:
    market = bounded_market_order(
        market="SOL",
        side="buy",
        reference_price=100,
        size=1,
        max_slippage_bps=50,
    )
    assert market["tif"] == "Ioc"
    assert market["limit_px"] == pytest.approx(100.5)
    assert len(
        scaled_orders(
            market="SOL",
            side="buy",
            total_size=1,
            start_price=95,
            end_price=99,
            levels=3,
        )
    ) == 3
    basket = basket_orders(
        total_notional_usd=100,
        max_slippage_bps=25,
        legs=[
            {"market": "BTC", "side": "buy", "weight": 2, "reference_price": 100_000},
            {"market": "SOL", "side": "sell", "weight": 1, "reference_price": 150},
        ],
    )
    assert sum(order["size"] * order["limit_px"] for order in basket) > 99


def test_follower_and_websocket_builders() -> None:
    approve, request = build_deposit_calls(ASSET, VAULT, 25_000_000)
    assert (approve.function_name, request.function_name) == ("approve", "requestDeposit")
    assert len(build_follower_read_calls(VAULT, LEADER)) == 6
    subscriptions = subscription_messages(VAULT, [{"type": "orderUpdates"}])
    assert json.loads(subscriptions[0])["subscription"] == {
        "type": "orderUpdates",
        "user": VAULT,
    }


def test_x402_uses_caller_payment_client_without_execution_token() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"paid": True})

    payment_client = httpx.Client(
        headers={"X-PAYMENT": "caller-created-proof"}, transport=httpx.MockTransport(handler)
    )
    intelligence = OmniX402Client("https://data.example", client=payment_client)
    assert intelligence.market_risk("SOL")["paid"] is True
    assert seen[0].headers["x-payment"] == "caller-created-proof"
    assert "authorization" not in seen[0].headers
