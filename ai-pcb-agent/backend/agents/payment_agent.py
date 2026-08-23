"""Payment Agent — autonomous spending guardrail.

WHAT CHANGED
------------
This agent used to drive a full x402 handshake (402 -> sign -> verify ->
settle) against Base Sepolia, via `tools/x402_service.py`. That module has
been DELETED: it produced EIP-3009 payloads signed with a demo key and a
local "facilitator" that minted fake `0x...` transaction hashes.

All real payments now happen in the Node x402 service (`x402-service/`),
which settles genuine USDC on Algorand Testnet through the GoPlausible
facilitator. FastAPI no longer touches money.

WHAT REMAINS
------------
The spend limit is a real guardrail and is worth keeping: it is the policy
check that stops an agent committing to an order larger than the operator
authorized. It backs up the human approval gate in the UI.
"""
import os

MAX_AUTONOMOUS_SPEND_USD = float(os.getenv("MAX_AUTONOMOUS_SPEND_USD", "50"))


class SpendLimitExceeded(Exception):
    def __init__(self, amount: float, limit: float):
        self.amount = amount
        self.limit = limit
        super().__init__(
            f"Order total ${amount} exceeds the autonomous spending limit of ${limit}. "
            "Additional explicit user approval is required."
        )


def check_spend_limit(amount_usd: float):
    """Raise SpendLimitExceeded if the order total exceeds the configured cap."""
    if amount_usd > MAX_AUTONOMOUS_SPEND_USD:
        raise SpendLimitExceeded(amount_usd, MAX_AUTONOMOUS_SPEND_USD)
