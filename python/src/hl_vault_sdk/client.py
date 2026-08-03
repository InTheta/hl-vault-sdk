from __future__ import annotations

import time
import uuid
from collections.abc import Callable, Mapping, Sequence
from typing import Any, cast

import httpx

from .signing import SignMessage

Json = dict[str, Any]


class VaultApiError(RuntimeError):
    def __init__(self, status: int, body: Any) -> None:
        message = body.get("error") if isinstance(body, dict) else None
        super().__init__(str(message or f"Vault API returned HTTP {status}"))
        self.status = status
        self.body = body


class _HttpClient:
    def __init__(
        self,
        base_url: str,
        *,
        token: str | None = None,
        headers: Mapping[str, str] | None = None,
        timeout: float = 15.0,
        client: httpx.Client | None = None,
    ) -> None:
        if not base_url.strip():
            raise ValueError("base_url is required")
        self.base_url = base_url.rstrip("/")
        self.token = token
        self._headers = dict(headers or {})
        self._owns_client = client is None
        self._client = client or httpx.Client(timeout=timeout)

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def __enter__(self) -> _HttpClient:
        return self

    def __exit__(self, *_args: object) -> None:
        self.close()

    def _request(
        self,
        method: str,
        path: str,
        *,
        json: Any = None,
        authenticated: bool = False,
        params: Mapping[str, Any] | None = None,
    ) -> Any:
        request_headers: dict[str, str] = {**self._headers, "Accept": "application/json"}
        if authenticated:
            if not self.token:
                raise ValueError("leader authentication token is required")
            request_headers["Authorization"] = f"Bearer {self.token}"
        response = self._client.request(
            method,
            f"{self.base_url}{path}",
            headers=request_headers,
            json=json,
            params=params,
        )
        try:
            body = response.json()
        except ValueError:
            body = None
        if not response.is_success:
            raise VaultApiError(response.status_code, body)
        return body


class PublicVaultClient(_HttpClient):
    def integration_manifest(self) -> Json:
        return cast(Json, self._request("GET", "/v1/integration/manifest"))

    def protocol_config(self) -> Json:
        return cast(Json, self._request("GET", "/v1/protocol/config"))

    def vaults(self) -> Json:
        return cast(Json, self._request("GET", "/v1/vaults"))

    def vault(self, address: str) -> Json:
        _address(address, "vault")
        return cast(Json, self._request("GET", f"/v1/vaults/{address}"))

    def performance(self, address: str, limit: int = 288) -> Json:
        _address(address, "vault")
        if not 2 <= limit <= 1_000:
            raise ValueError("performance limit must be 2 through 1000")
        return cast(
            Json,
            self._request(
                "GET", f"/v1/vaults/{address}/performance", params={"limit": limit}
            ),
        )

    def points_leaderboard(self) -> Json:
        return cast(Json, self._request("GET", "/v1/points/leaderboard"))

    def wallet_points(self, address: str) -> Json:
        _address(address, "wallet")
        return cast(Json, self._request("GET", f"/v1/points/wallet/{address}"))

    def points_preview(self, input: Mapping[str, Any]) -> Json:
        return cast(Json, self._request("POST", "/v1/points/preview", json=dict(input)))

    def points_carryover_preview(self, input: Mapping[str, Any]) -> Json:
        return cast(
            Json,
            self._request(
                "POST", "/v1/points/testnet-carryover-preview", json=dict(input)
            ),
        )


class HyperliquidVaultReadClient(_HttpClient):
    def info(self, request: Mapping[str, Any]) -> Any:
        return self._request("POST", "/info", json=dict(request))

    def clearinghouse_state(self, vault: str, dex: str | None = None) -> Json:
        _address(vault, "vault")
        request: Json = {"type": "clearinghouseState", "user": vault}
        if dex:
            request["dex"] = dex
        return cast(Json, self.info(request))

    def spot_clearinghouse_state(self, vault: str) -> Json:
        _address(vault, "vault")
        return cast(Json, self.info({"type": "spotClearinghouseState", "user": vault}))

    def open_orders(self, vault: str, dex: str | None = None) -> list[Json]:
        _address(vault, "vault")
        request: Json = {"type": "openOrders", "user": vault}
        if dex:
            request["dex"] = dex
        return cast(list[Json], self.info(request))

    def portfolio(self, vault: str) -> list[Any]:
        _address(vault, "vault")
        return cast(list[Any], self.info({"type": "portfolio", "user": vault}))

    def account(self, vault: str, dexes: Sequence[str] = ()) -> Json:
        return {
            "vault": vault,
            "perps": self.clearinghouse_state(vault),
            "spot": self.spot_clearinghouse_state(vault),
            "openOrders": self.open_orders(vault),
            "portfolio": self.portfolio(vault),
            "perpDexs": {dex: self.clearinghouse_state(vault, dex) for dex in dexes},
        }


class OmniDataPlaneClient(_HttpClient):
    """Read-only Omni news, liquidation, order-book and margin-stress data."""

    def news(self, symbol: str | None = None, limit: int = 20) -> Any:
        suffix = f"/{symbol}" if symbol else ""
        return self._request(
            "GET", f"/api/terminal/news{suffix}", params={"limit": _bounded(limit, 1, 200)}
        )

    def liquidation_stats(
        self, exchange: str, symbol: str, scope: str = "current"
    ) -> Any:
        if scope not in {"current", "aggregate"}:
            raise ValueError("scope must be current or aggregate")
        return self._request(
            "GET",
            f"/api/terminal/liquidation-stats/{exchange}/{symbol}",
            params={"scope": scope},
        )

    def orderbook(self, symbol: str, depth: int = 20) -> Any:
        return self._request(
            "GET",
            "/api/terminal/orderbook",
            params={"symbol": symbol, "depth": _bounded(depth, 1, 1_000)},
        )

    def margin_stress(self, limit: int = 24) -> Any:
        return self._request(
            "GET", "/api/terminal/margin-stress", params={"limit": _bounded(limit, 1, 200)}
        )


class OmniX402Client(_HttpClient):
    """Paid intelligence client using a caller-supplied payment-enabled HTTPX client."""

    def health(self) -> Any:
        return self._request("GET", "/api/x402/v1/news/health")

    def market_risk(self, symbol: str, event_window_minutes: int = 60, limit: int = 5) -> Any:
        if event_window_minutes not in {15, 60}:
            raise ValueError("event_window_minutes must be 15 or 60")
        return self._request(
            "GET",
            f"/api/x402/v1/market-risk/{symbol}",
            params={
                "scope": "current",
                "event_window_minutes": event_window_minutes,
                "limit": _bounded(limit, 1, 10),
            },
        )

    def market_snapshot(self, symbol: str, interval: str = "1h", limit: int = 120) -> Any:
        return self._request(
            "GET",
            f"/api/x402/v1/market-snapshot/{symbol}",
            params={
                "interval": interval,
                "limit": _bounded(limit, 20, 200),
                "scope": "aggregate",
                "include_liquidations": "true",
            },
        )

    def market_carry(self, symbol: str) -> Any:
        return self._request("GET", f"/api/x402/v1/market-carry/{symbol}")

    def mcp(self, message: Mapping[str, Any]) -> Any:
        return self._request("POST", "/api/x402/mcp", json=dict(message))


class LeaderTradingClient(_HttpClient):
    def capabilities(self) -> Json:
        return cast(Json, self._request("GET", "/v1/capabilities"))

    def set_token(self, token: str) -> None:
        if not token:
            raise ValueError("token is required")
        self.token = token

    def clear_token(self) -> None:
        self.token = None

    def authorize_leader(self, address: str, sign_message: SignMessage) -> Json:
        _address(address, "leader")
        challenge = cast(
            Json, self._request("POST", "/v1/auth/challenge", json={"address": address})
        )
        if int(challenge["expiresAt"]) <= _now_ms():
            raise RuntimeError("leader challenge expired")
        signature = sign_message(str(challenge["message"]))
        session = cast(
            Json,
            self._request(
                "POST",
                "/v1/auth/session",
                json={"challengeId": challenge["challengeId"], "signature": signature},
            ),
        )
        self.token = str(session["token"])
        return session

    def delegate_agent(
        self,
        address: str,
        *,
        agent_id: str,
        scopes: Sequence[str],
        allowed_markets: Sequence[str],
        max_notional_usd: float,
        session_expires_at: int,
        sign_message: SignMessage,
        allow_taker: bool = False,
    ) -> Json:
        _address(address, "leader")
        if not 3 <= len(agent_id) <= 64 or not all(
            character.isalnum() or character in "._-" for character in agent_id
        ):
            raise ValueError("agent_id must be 3..64 letters, digits, dots, dashes or underscores")
        if not scopes or not allowed_markets:
            raise ValueError("agent scopes and allowed markets are required")
        if max_notional_usd <= 0:
            raise ValueError("max_notional_usd must be positive")
        remaining = session_expires_at - _now_ms()
        if remaining <= 0 or remaining > 60 * 60_000:
            raise ValueError("agent session must expire within one hour")
        challenge = cast(
            Json,
            self._request(
                "POST",
                "/v1/auth/agent-challenge",
                json={
                    "address": address,
                    "agentId": agent_id,
                    "scopes": list(scopes),
                    "allowedMarkets": list(allowed_markets),
                    "maxNotionalUsd": max_notional_usd,
                    "allowTaker": allow_taker,
                    "sessionExpiresAt": session_expires_at,
                },
            ),
        )
        if int(challenge["challengeExpiresAt"]) <= _now_ms():
            raise RuntimeError("agent delegation challenge expired")
        signature = sign_message(str(challenge["message"]))
        return cast(
            Json,
            self._request(
                "POST",
                "/v1/auth/agent-session",
                json={"challengeId": challenge["challengeId"], "signature": signature},
            ),
        )

    def revoke_agent_session(self, session_id: str) -> Json:
        return cast(Json, self._auth("POST", "/v1/auth/agent-revoke", {"sessionId": session_id}))

    def account(self) -> Json:
        return cast(Json, self._auth("GET", "/v1/account"))

    def open_orders(self) -> list[Json]:
        return cast(list[Json], self._auth("GET", "/v1/open-orders"))

    def info(self, request: Mapping[str, Any]) -> Any:
        return self._auth("POST", "/info", dict(request))

    def exchange(self, envelope: Mapping[str, Any]) -> Any:
        return self._auth("POST", "/exchange", dict(envelope))

    def place_order(
        self,
        *,
        market: str,
        side: str,
        limit_px: float,
        size: float,
        tif: str = "Alo",
        reduce_only: bool = False,
        client_order_id: str | None = None,
    ) -> Json:
        _order(market, side, limit_px, size, tif)
        return cast(
            Json,
            self._auth(
                "POST",
                "/v1/orders",
                {
                    "market": market,
                    "side": side,
                    "limit_px": limit_px,
                    "size": size,
                    "tif": tif,
                    "reduce_only": reduce_only,
                    "client_order_id": client_order_id or str(uuid.uuid4()),
                },
            ),
        )

    def place_order_batch(self, orders: Sequence[Mapping[str, Any]]) -> Json:
        if not 1 <= len(orders) <= 20:
            raise ValueError("order batch must contain 1 through 20 orders")
        normalized: list[Json] = []
        for source in orders:
            order = dict(source)
            _order(
                str(order.get("market", "")),
                str(order.get("side", "")),
                float(order.get("limit_px", 0)),
                float(order.get("size", 0)),
                str(order.get("tif", "Alo")),
            )
            order.setdefault("reduce_only", False)
            order.setdefault("client_order_id", str(uuid.uuid4()))
            normalized.append(order)
        return cast(Json, self._auth("POST", "/v1/orders/batch", {"orders": normalized}))

    def close_position(
        self,
        *,
        market: str,
        side: str,
        limit_px: float,
        size: float,
        tif: str = "Ioc",
        client_order_id: str | None = None,
    ) -> Json:
        return self.place_order(
            market=market,
            side=side,
            limit_px=limit_px,
            size=size,
            tif=tif,
            reduce_only=True,
            client_order_id=client_order_id,
        )

    def cancel_order(self, market: str, client_order_id: str) -> Any:
        if not market or not client_order_id:
            raise ValueError("market and client_order_id are required")
        return self._auth(
            "POST",
            "/v1/cancels",
            {"market": market, "client_order_id": client_order_id},
        )

    def cancel_all_orders(self, markets: Sequence[str] = ()) -> Json:
        if len(markets) > 100 or any(not market.strip() for market in markets):
            raise ValueError("cancel-all accepts up to 100 non-empty market filters")
        return cast(Json, self._auth("POST", "/v1/cancels/all", {"markets": list(markets)}))

    def start_managed_twap(
        self,
        *,
        market: str,
        side: str,
        size: float,
        minutes: int,
        randomize: bool = True,
        reduce_only: bool = False,
    ) -> Json:
        if side not in {"buy", "sell"} or size <= 0 or not 5 <= minutes <= 1_440:
            raise ValueError("TWAP requires buy/sell, positive size and 5..1440 minutes")
        return cast(
            Json,
            self._auth(
                "POST",
                "/v1/twaps",
                {
                    "market": market,
                    "side": side,
                    "size": size,
                    "minutes": minutes,
                    "randomize": randomize,
                    "reduce_only": reduce_only,
                },
            ),
        )

    def managed_twaps(self) -> Json:
        return cast(Json, self._auth("GET", "/v1/twaps"))

    def cancel_managed_twap(self, twap_id: int) -> Json:
        if twap_id <= 0:
            raise ValueError("twap_id must be positive")
        return cast(Json, self._auth("POST", "/v1/twaps/cancel", {"twap_id": twap_id}))

    def _auth(self, method: str, path: str, body: Any = None) -> Any:
        return self._request(method, path, json=body, authenticated=True)


class VaultTerminalClient:
    def __init__(
        self,
        manifest: Json,
        public: PublicVaultClient,
        hyperliquid: HyperliquidVaultReadClient,
        trading: LeaderTradingClient | None,
    ) -> None:
        self.manifest = manifest
        self.public = public
        self.hyperliquid = hyperliquid
        self.trading = trading

    @classmethod
    def connect(
        cls,
        vault_api_url: str,
        *,
        trade_gateway_url: str | None = None,
        token: str | None = None,
        headers: Mapping[str, str] | None = None,
        client_factory: Callable[..., httpx.Client] | None = None,
    ) -> VaultTerminalClient:
        def make_client() -> httpx.Client | None:
            return client_factory() if client_factory else None

        public = PublicVaultClient(vault_api_url, headers=headers, client=make_client())
        manifest = public.integration_manifest()
        schema = str(manifest.get("schema", ""))
        if not schema.endswith("/hl-vault-terminal-integration/v1"):
            public.close()
            raise ValueError(f"unsupported integration manifest: {schema}")
        hyperliquid = HyperliquidVaultReadClient(
            str(manifest["hyperliquid"]["api_url"]), client=make_client()
        )
        gateway = trade_gateway_url or manifest.get("leader_execution", {}).get("gateway_url")
        trading = (
            LeaderTradingClient(str(gateway), token=token, headers=headers, client=make_client())
            if gateway
            else None
        )
        return cls(manifest, public, hyperliquid, trading)

    def dashboard(self, vault: str, performance_limit: int = 288) -> Json:
        return {
            "manifest": self.manifest,
            "vault": self.public.vault(vault),
            "performance": self.public.performance(vault, performance_limit),
            "account": self.hyperliquid.account(vault),
        }

    def require_trading(self) -> LeaderTradingClient:
        if not self.trading:
            raise RuntimeError("manifest does not advertise a leader execution gateway")
        return self.trading

    def close(self) -> None:
        self.public.close()
        self.hyperliquid.close()
        if self.trading:
            self.trading.close()

    def __enter__(self) -> VaultTerminalClient:
        return self

    def __exit__(self, *_args: object) -> None:
        self.close()


def _address(value: str, label: str) -> None:
    if len(value) != 42 or not value.startswith("0x"):
        raise ValueError(f"{label} must be a 20-byte 0x-prefixed address")
    try:
        int(value[2:], 16)
    except ValueError as error:
        raise ValueError(f"{label} must be a 20-byte 0x-prefixed address") from error


def _order(market: str, side: str, limit_px: float, size: float, tif: str) -> None:
    if not market:
        raise ValueError("market is required")
    if side not in {"buy", "sell"}:
        raise ValueError("side must be buy or sell")
    if limit_px <= 0 or size <= 0:
        raise ValueError("price and size must be positive")
    if tif not in {"Alo", "Gtc", "Ioc"}:
        raise ValueError("tif must be Alo, Gtc or Ioc")


def _now_ms() -> int:
    return time.time_ns() // 1_000_000


def _bounded(value: int, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, value))
