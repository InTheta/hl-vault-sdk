import os

import httpx

from hl_vault_sdk import OmniX402Client


class PaymentAuth(httpx.Auth):
    def auth_flow(self, request: httpx.Request):  # type: ignore[no-untyped-def]
        # Replace this example header with the selected x402 client's challenge/payment flow.
        request.headers["X-PAYMENT"] = os.environ["X402_PAYMENT_PROOF"]
        yield request


with httpx.Client(auth=PaymentAuth()) as payment_client:
    intelligence = OmniX402Client(
        os.getenv("OMNI_X402_URL", "https://omniterminal.app"), client=payment_client
    )
    print(intelligence.market_risk(os.getenv("MARKET", "SOL")))
