# Ugent — Agent Scope

## In-Scope (agent may fix)
- Security: privacy-leaking logs, unprotected webhooks, missing auth
- Bug fixes with test evidence
- Missing error handling (try/catch on async I/O)
- Lazy-load env vars instead of module-load-time access
- Dead code removal

## Out-of-Scope (agent must NOT touch)
- Chat API routes (no tests — risk of breakage without coverage)
- Cron job routes (`/api/cron/*`) — no tests, do not modify
- Telegram webhook handler — no tests, privacy-sensitive
- WhatsApp webhook business logic beyond what's already fixed
- Frontend UI in ugent-app (separate repo at ~/Developer/ugent-app)
- Files with uncommitted user changes (check git status first)

## Test Requirement
Run `npm test` — all 37 tests must pass. No regressions allowed.
