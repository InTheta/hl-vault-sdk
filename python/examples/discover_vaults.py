import os

from hl_vault_sdk import VaultTerminalClient

with VaultTerminalClient.connect(os.environ["HL_VAULT_API_URL"]) as terminal:
    vaults = terminal.public.vaults()["vaults"]
    for vault in vaults:
        dashboard = terminal.dashboard(vault["address"], performance_limit=48)
        print(
            vault["name"],
            vault["address"],
            "TVL", vault["tvl_usdc"],
            "positions", len(dashboard["account"]["perps"].get("assetPositions", [])),
        )
