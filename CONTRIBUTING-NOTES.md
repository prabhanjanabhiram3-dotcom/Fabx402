# Build status

Verified on the exact contents of this repository:

| Check | Result |
|---|---|
| `backend` — FastAPI imports, 14 routes | pass |
| `backend` — every `.py` compiles | pass |
| `frontend` — `tsc --noEmit` | pass, 0 errors |
| `frontend` — `next build` | compiled successfully |
| `x402-service` — `tsc --noEmit` | pass, 0 errors |
| `x402-service` — `npm audit` | 0 vulnerabilities |
| Scripts — syntax check | pass |
| Secret scan | no keys, no `.env`, no mnemonics |

## Known advisory

`npm audit` on the frontend reports 2 high findings that are only fixable by
upgrading to Next.js 16 (a major version bump):

1. **Image Optimizer `remotePatterns` DoS** — does not apply: this app does not
   use `next/image` anywhere.
2. **PostCSS `</style>` stringify XSS** — build-time tooling, not a runtime path
   in this application.

Next.js is pinned to **14.2.35**, the latest patched 14.x. Upgrading to 16 means
React 19 and App Router changes, which is not a change worth making immediately
before a demo. Revisit after the hackathon.
