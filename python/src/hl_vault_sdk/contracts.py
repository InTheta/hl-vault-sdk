from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ContractCall:
    address: str
    abi: list[dict[str, Any]]
    function_name: str
    args: tuple[Any, ...] = ()


ERC20_ABI: list[dict[str, Any]] = [
    {
        "type": "function",
        "name": "approve",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "outputs": [{"name": "", "type": "bool"}],
    },
    {
        "type": "function",
        "name": "balanceOf",
        "stateMutability": "view",
        "inputs": [{"name": "account", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]


def _view(name: str, inputs: list[dict[str, str]], outputs: list[dict[str, str]]) -> dict[str, Any]:
    return {
        "type": "function",
        "name": name,
        "stateMutability": "view",
        "inputs": inputs,
        "outputs": outputs,
    }


def _write(name: str, inputs: list[dict[str, str]] | None = None) -> dict[str, Any]:
    return {
        "type": "function",
        "name": name,
        "stateMutability": "nonpayable",
        "inputs": inputs or [],
        "outputs": [],
    }


_UINT = [{"name": "", "type": "uint256"}]
ASYNC_HYPER_VAULT_ABI: list[dict[str, Any]] = [
    _view("balanceOf", [{"name": "account", "type": "address"}], _UINT),
    _view(
        "depositRequests",
        [{"name": "user", "type": "address"}],
        [
            {"name": "epoch", "type": "uint64"},
            {"name": "amount", "type": "uint192"},
            {"name": "basisAssets", "type": "uint192"},
        ],
    ),
    _view(
        "redeemRequests",
        [{"name": "user", "type": "address"}],
        [
            {"name": "epoch", "type": "uint64"},
            {"name": "amount", "type": "uint192"},
            {"name": "basisAssets", "type": "uint192"},
        ],
    ),
    _view("costBasisAssets", [{"name": "user", "type": "address"}], _UINT),
    _view(
        "lockupUntil",
        [{"name": "user", "type": "address"}],
        [{"name": "", "type": "uint64"}],
    ),
    _view("currentEpoch", [], [{"name": "", "type": "uint64"}]),
    _view("activeNavAssets", [], _UINT),
    _view("totalSupply", [], _UINT),
    _view("publicDepositsEnabled", [], [{"name": "", "type": "bool"}]),
    _view("maxPublicDepositAssets", [], _UINT),
    _view("leader", [], [{"name": "", "type": "address"}]),
    _view("leaderShareBps", [], _UINT),
    _view("leaderCommissionAssets", [], _UINT),
    _view("builderFeeActive", [], [{"name": "", "type": "bool"}]),
    _view("builderFeeApprovalRequested", [], [{"name": "", "type": "bool"}]),
    _view("builderFeeRecipient", [], [{"name": "", "type": "address"}]),
    _view("requiredBuilderFeeDecibps", [], [{"name": "", "type": "uint64"}]),
    _write("requestDeposit", [{"name": "assets", "type": "uint256"}]),
    _write("cancelDepositRequest"),
    _write("claimDeposit"),
    _write("requestRedeem", [{"name": "shares", "type": "uint256"}]),
    _write("cancelRedeemRequest"),
    _write("claimRedeem"),
]


def build_deposit_calls(asset: str, vault: str, assets: int) -> tuple[ContractCall, ContractCall]:
    _address(asset, "asset")
    _address(vault, "vault")
    _positive(assets, "assets")
    return (
        ContractCall(asset, ERC20_ABI, "approve", (vault, assets)),
        ContractCall(vault, ASYNC_HYPER_VAULT_ABI, "requestDeposit", (assets,)),
    )


def build_follower_read_calls(vault: str, wallet: str) -> list[ContractCall]:
    _address(vault, "vault")
    _address(wallet, "wallet")
    return [
        ContractCall(vault, ASYNC_HYPER_VAULT_ABI, "balanceOf", (wallet,)),
        ContractCall(vault, ASYNC_HYPER_VAULT_ABI, "depositRequests", (wallet,)),
        ContractCall(vault, ASYNC_HYPER_VAULT_ABI, "redeemRequests", (wallet,)),
        ContractCall(vault, ASYNC_HYPER_VAULT_ABI, "costBasisAssets", (wallet,)),
        ContractCall(vault, ASYNC_HYPER_VAULT_ABI, "lockupUntil", (wallet,)),
        ContractCall(vault, ASYNC_HYPER_VAULT_ABI, "currentEpoch"),
    ]


def build_claim_deposit_call(vault: str) -> ContractCall:
    return _vault_call(vault, "claimDeposit")


def build_redeem_call(vault: str, shares: int) -> ContractCall:
    _positive(shares, "shares")
    return _vault_call(vault, "requestRedeem", shares)


def build_claim_redeem_call(vault: str) -> ContractCall:
    return _vault_call(vault, "claimRedeem")


def build_cancel_deposit_call(vault: str) -> ContractCall:
    return _vault_call(vault, "cancelDepositRequest")


def build_cancel_redeem_call(vault: str) -> ContractCall:
    return _vault_call(vault, "cancelRedeemRequest")


def _vault_call(vault: str, function_name: str, *args: Any) -> ContractCall:
    _address(vault, "vault")
    return ContractCall(vault, ASYNC_HYPER_VAULT_ABI, function_name, args)


def _address(value: str, label: str) -> None:
    if len(value) != 42 or not value.startswith("0x"):
        raise ValueError(f"{label} must be a 20-byte 0x-prefixed address")
    try:
        int(value[2:], 16)
    except ValueError as error:
        raise ValueError(f"{label} must be a 20-byte 0x-prefixed address") from error


def _positive(value: int, label: str) -> None:
    if value <= 0:
        raise ValueError(f"{label} must be positive")
