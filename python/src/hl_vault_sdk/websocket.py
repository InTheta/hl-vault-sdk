from __future__ import annotations

import json
from collections.abc import AsyncIterator, Sequence
from typing import Any

from websockets.asyncio.client import connect


def subscription_messages(vault: str, subscriptions: Sequence[dict[str, Any]]) -> list[str]:
    if len(vault) != 42 or not vault.startswith("0x"):
        raise ValueError("vault must be a 20-byte 0x-prefixed address")
    try:
        int(vault[2:], 16)
    except ValueError as error:
        raise ValueError("vault must be a 20-byte 0x-prefixed address") from error
    return [
        json.dumps(
            {
                "method": "subscribe",
                "subscription": {**subscription, "user": vault},
            },
            separators=(",", ":"),
        )
        for subscription in subscriptions
    ]


async def stream_vault_events(
    url: str,
    vault: str,
    subscriptions: Sequence[dict[str, Any]] = (
        {"type": "webData3"},
        {"type": "orderUpdates"},
        {"type": "userFills", "aggregateByTime": True},
    ),
) -> AsyncIterator[Any]:
    """Reconnect, resubscribe and yield decoded vault-account messages."""
    messages = subscription_messages(vault, subscriptions)
    async for websocket in connect(
        url,
        open_timeout=10,
        ping_interval=20,
        ping_timeout=20,
        max_size=2**20,
    ):
        for message in messages:
            await websocket.send(message)
        async for raw in websocket:
            try:
                yield json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                yield raw
