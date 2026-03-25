# Deploy ugent to Vercel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the ugent Next.js backend to the `ugent` Vercel project with all env vars, verify via browser.

**Architecture:** Re-link local repo from deleted `ugent2` → active `ugent` project. Set env vars via Vercel CLI, push to GitHub, deploy via Vercel MCP, browser-verify, check logs.

**Tech Stack:** Next.js 15, WorkOS AuthKit, Convex, Vercel CLI v50, Vercel MCP

---

## Env Vars Inventory

All values sourced from local `.env`, `.env.local`, `.env.production`:

| Key | Source | Notes |
|-----|--------|-------|
| `WORKOS_API_KEY` | `.env.local` | WorkOS secret key |
| `WORKOS_CLIENT_ID` | `.env.local` | WorkOS client ID |
| `WORKOS_COOKIE_PASSWORD` | `.env.local` | Cookie signing secret |
| `WORKOS_REDIRECT_URI` | set after deploy | Production URL + `/callback` |
| `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | set after deploy | Same as above |
| `NEXT_PUBLIC_CONVEX_URL` | `.env.local` | Convex cloud URL |
| `OPENAI_API_KEY` | `.env` | OpenAI key |
| `PINECONE_API_KEY` | `.env` | Pinecone key |
| `PINECONE_INDEX_NAME` | `.env` | `ugent` |
| `TAVILY_API_KEY` | `.env` | Tavily search key |
| `RESEND_API_KEY` | `.env` | Email send key |
| `SENTRY_AUTH_TOKEN` | `.env` | Sentry auth |
| `ELEVENLABS_API_KEY` | `.env` | ElevenLabs key |
| `FACTS_EMAIL_TO` | `.env` | `jimkalinov@gmail.com` |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | `.env.production` | WhatsApp BA ID |
| `WHATSAPP_PHONE_NUMBER_ID` | `.env.production` | WA phone number |
| `WHATSAPP_TOKEN` | `.env.production` | WA API token |
| `WHATSAPP_VERIFY_TOKEN` | `.env.production` | WA webhook verify |
| `WHATSAPP_RECIPIENTS` | `.env.production` | WA recipients |
| `TELEGRAM_BOT_TOKEN` | `.env.production` | Telegram bot token |
| `TELEGRAM_WEBHOOK_SECRET` | `.env.production` | Telegram secret |
| `TELEGRAM_RECIPIENTS` | `.env.production` | `8538224711` |

---

### Task 1: Fix local Vercel project link

**Files:**
- Modify: `.vercel/project.json`

- [ ] **Step 1: Update project.json to point to ugent project**

Replace `ugent2` (deleted) with `ugent` (active):
```json
{
  "projectId": "prj_8UwadbEjnpur7k2PAYKcW2L0hgCY",
  "orgId": "team_LJBJccscuamL1PpCjZj8jgZi"
}
```

- [ ] **Step 2: Verify link works**

Run: `vercel project ls --scope intelogroups-projects 2>&1 | grep ugent`
Expected: shows `ugent` project

---

### Task 2: Push to GitHub

- [ ] **Step 1: Push current main branch**

Run: `git push origin main`
Expected: success — `intelogroup/ugent` repo updated

---

### Task 3: Set env vars on Vercel `ugent` project

Use Vercel CLI: `echo "VALUE" | vercel env add KEY production --scope intelogroups-projects`

- [ ] **Step 1: Set all static env vars (not WORKOS_REDIRECT_URI yet)**

Set each key listed in env vars inventory except `WORKOS_REDIRECT_URI` and `NEXT_PUBLIC_WORKOS_REDIRECT_URI`.

- [ ] **Step 2: Verify env vars exist**

Run: `vercel env ls --scope intelogroups-projects 2>&1`
Expected: all keys appear in the list

---

### Task 4: Initial deploy to get production URL

- [ ] **Step 1: Deploy via Vercel MCP**

Use `mcp__claude_ai_Vercel__deploy_to_vercel` tool.

- [ ] **Step 2: Capture production URL**

From deploy output, extract the production URL (e.g. `ugent-xxx.vercel.app`).

---

### Task 5: Set WorkOS redirect URI with production URL

- [ ] **Step 1: Set WORKOS_REDIRECT_URI**

Run: `echo "https://<PROD_URL>/callback" | vercel env add WORKOS_REDIRECT_URI production --scope intelogroups-projects`

- [ ] **Step 2: Set NEXT_PUBLIC_WORKOS_REDIRECT_URI**

Run: `echo "https://<PROD_URL>/callback" | vercel env add NEXT_PUBLIC_WORKOS_REDIRECT_URI production --scope intelogroups-projects`

- [ ] **Step 3: Redeploy to pick up the new env vars**

Run: `vercel --prod --scope intelogroups-projects`

---

### Task 6: Browser verify + check Vercel logs

- [ ] **Step 1: Use agent-browser to open the production URL**

Navigate to `https://<PROD_URL>/login` — expect WorkOS hosted login page to load.

- [ ] **Step 2: Check Vercel runtime logs**

Use `mcp__claude_ai_Vercel__get_runtime_logs` for the `ugent` project.
Expected: no 500 errors on startup.

- [ ] **Step 3: Check build logs**

Use `mcp__claude_ai_Vercel__get_deployment_build_logs` for the latest deployment.
Expected: build succeeded, no TypeScript errors.
