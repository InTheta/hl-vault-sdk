import asyncio
import os

from hl_vault_sdk import stream_vault_events


async def main() -> None:
    async for event in stream_vault_events(
        "wss://api.hyperliquid-testnet.xyz/ws", os.environ["HL_VAULT_ADDRESS"]
    ):
        print(event)


asyncio.run(main())
