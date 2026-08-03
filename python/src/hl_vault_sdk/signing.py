from collections.abc import Callable

from eth_account import Account
from eth_account.messages import encode_defunct

SignMessage = Callable[[str], str]


def sign_eip191_message(message: str, private_key: str) -> str:
    """Sign the exact gateway challenge as an EIP-191 personal message."""
    if not message:
        raise ValueError("message is required")
    if not private_key:
        raise ValueError("private_key is required")
    signed = Account.sign_message(encode_defunct(text=message), private_key=private_key)
    signature = signed.signature.hex()
    return signature if signature.startswith("0x") else f"0x{signature}"


def local_account_signer(private_key: str) -> tuple[str, SignMessage]:
    """Create a server-side signer callback. Never use this in a browser or log the key."""
    account = Account.from_key(private_key)

    def sign(message: str) -> str:
        return sign_eip191_message(message, private_key)

    return account.address, sign
