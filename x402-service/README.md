# x402-service

Real Algorand x402 payment service for the AI PCB Manufacturing Agent.
Settles USDC on Algorand Testnet through the GoPlausible facilitator.

## Where this folder lives

    x402-Algorand\
    ├── ai-pcb-agent\      (backend + frontend)
    └── x402-service\      (this folder)

## Setup

    copy .env.example .env
    # edit .env -> set RESOURCE_PAY_TO to your Algorand address
    #              (must be opted in to USDC ASA 10458941)
    npm install
    npm run start

Service boots on http://localhost:3001 and prints its network, asset,
facilitator and payTo address.

## Validate before demoing

In a second terminal, with the service running:

    node scripts\test-x402-algorand.mjs

Six checks must pass. If the protected endpoint returns 500 instead of 402,
the service could not reach facilitator.goplausible.xyz at startup — that is
a network problem, not a code problem.

## Protected endpoints

    POST /api/inference                  AI inference  (x402, $0.01)
    POST /api/x402/manufacturing-order   Manufacturing (x402, $0.01)

Free: GET /api/health, GET /.well-known/x402, GET /api/orders/:id
