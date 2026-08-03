# Follower deposit and redemption lifecycle

The follower keeps custody of their wallet and signs normal HyperEVM contract
transactions. The SDK only builds ABI call descriptions.

## Deposit

1. Check the manifest network, asset address, decimals and
   `follower_flow.transactions_enabled`.
2. Read asset balance/allowance and the six calls returned by
   `buildFollowerReadRequests`.
3. Submit ERC-20 `approve(vault, assets)` if required.
4. Submit `requestDeposit(assets)` and show **Deposit pending** after receipt.
5. After epoch settlement, show **Shares claimable**.
6. Submit `claimDeposit()`; refresh contract reads after receipt.

## Redemption

1. Submit `requestRedeem(shares)` and show **Redemption pending**.
2. Respect `lockupUntil`; do not promise immediate liquidity.
3. After settlement, submit `claimRedeem()` and show the received asset amount.

Users may cancel an unsettled request with `cancelDepositRequest()` or
`cancelRedeemRequest()`. Disable duplicate buttons while a transaction is
pending and key UI state by chain ID, vault, wallet and transaction hash.

Fees must be shown before signature using manifest/config values. Display
leader profit share only on positive profit and distinguish it from entry or
withdrawal fees. During testnet preview, mock assets have no monetary value.
