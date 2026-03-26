# CLI Environment Setup for Local Development

This guide explains how to configure environment variables so that CLI tools (Vercel, Convex) are accessible in your terminal and in Claude Code sessions.

## Why This Is Needed

`.env.local` is only read by Next.js at runtime (`next dev` / `next build`). CLI tools like `vercel` and `npx convex` need environment variables available in the **shell**. This setup ensures both work.

## Step 1: Install CLI Tools

```bash
npm i -g vercel
```

Convex CLI is already available via `npx convex`.

## Step 2: Create a `.env` File

Create a `.env` file in the project root with the following keys:

```bash
# Vercel — generate at https://vercel.com/account/tokens
VERCEL_TOKEN=your_vercel_token_here
VERCEL_ORG_ID=your_org_id_here
VERCEL_PROJECT_ID=your_project_id_here

# Convex — get from https://dashboard.convex.dev → Settings → Deploy keys
CONVEX_DEPLOY_KEY=your_convex_deploy_key_here
```

> **Important:** `.env` is already in `.gitignore` — it will NOT be committed. Never commit tokens or secrets.

## Step 3: Source `.env` in Your Shell

The `.env` file is only useful inside the ugent project directory. **Do not** add a generic `source .env` to your shell rc — it would load whichever `.env` is in your current directory, risking token leakage from other projects.

Instead, source it manually after navigating into the project:

```bash
cd ~/path/to/ugent
source .env
```

Or, for automatic directory-scoped loading, use [direnv](https://direnv.net/):

```bash
# Install direnv, then add to ~/.bashrc or ~/.zshrc:
eval "$(direnv hook bash)"  # or: eval "$(direnv hook zsh)"
```

Then create a `.envrc` in the project root:

```bash
# ugent/.envrc
dotenv
```

Run `direnv allow` once, and variables will load/unload automatically when you enter/leave the directory.

## Step 4: Configure Claude Code (Optional)

For Claude Code sessions (CLI/web), add env vars to your Claude Code settings so they're available automatically:

1. Open Claude Code
2. Run `/config` to open settings, or edit `~/.claude/settings.json` directly
3. Add environment variables under the `env` key:

```json
{
  "env": {
    "VERCEL_TOKEN": "your_vercel_token_here",
    "CONVEX_DEPLOY_KEY": "your_convex_deploy_key_here"
  }
}
```

This allows Claude Code to run commands like `vercel ls --prod` and `npx convex deploy` on your behalf.

## Verifying Access

After setup, verify the tools work:

```bash
# Vercel
vercel ls --prod --token $VERCEL_TOKEN

# Convex
npx convex status
```

## What Goes Where

| File | Purpose | Git tracked? |
|------|---------|-------------|
| `.env.local` | Next.js runtime vars (WorkOS, etc.) | No |
| `.env` | CLI tool tokens (Vercel, Convex) | No |
| Claude Code `settings.json` | Env vars for Claude Code sessions | No |
