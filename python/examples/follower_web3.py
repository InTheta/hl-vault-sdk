import os

from web3 import Web3

from hl_vault_sdk import build_deposit_calls

rpc = Web3(Web3.HTTPProvider(os.environ["HYPEREVM_RPC_URL"]))
account = rpc.eth.account.from_key(os.environ["FOLLOWER_PRIVATE_KEY"])
asset = os.environ["HL_VAULT_ASSET_ADDRESS"]
vault = os.environ["HL_VAULT_ADDRESS"]
assets = int(os.getenv("DEPOSIT_ASSETS", "1000000"))
calls = build_deposit_calls(asset, vault, assets)

print(
    {
        "wallet": account.address,
        "vault": vault,
        "assets": assets,
        "execute": os.getenv("EXECUTE") == "1",
    }
)
if os.getenv("EXECUTE") == "1":
    nonce = rpc.eth.get_transaction_count(account.address)
    for call in calls:
        contract = rpc.eth.contract(address=Web3.to_checksum_address(call.address), abi=call.abi)
        transaction = getattr(contract.functions, call.function_name)(*call.args).build_transaction(
            {
                "from": account.address,
                "nonce": nonce,
                "chainId": rpc.eth.chain_id,
                "gasPrice": rpc.eth.gas_price,
            }
        )
        transaction["gas"] = rpc.eth.estimate_gas(transaction)
        signed = account.sign_transaction(transaction)
        tx_hash = rpc.eth.send_raw_transaction(signed.raw_transaction)
        receipt = rpc.eth.wait_for_transaction_receipt(tx_hash)
        if receipt.status != 1:
            raise RuntimeError(f"transaction reverted: {tx_hash.hex()}")
        print({"function": call.function_name, "tx": tx_hash.hex()})
        nonce += 1
