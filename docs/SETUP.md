# SETUP

Local development setup. Config values here are **placeholders** — put real values only in `.env.local` (gitignored), never in the repo.

## Prerequisites

- Node.js 20+ and npm
- A Supabase project (free tier is fine) — [supabase.com](https://supabase.com)

## 1. Install

```bash
npm install
```

## 2. Configure environment

Copy the example and fill in your project's values:

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Find both values in the Supabase dashboard → **Project Settings → API**. Use the **anon/public** key — **never** the `service_role` key (it bypasses RLS and must not touch this app). `.env.local` is gitignored; keep real keys out of commits, docs, and screenshots.

## 3. Apply database migrations

There's no Supabase CLI here — run migrations **by hand, in order**, in the dashboard **SQL Editor** (paste each file's contents and run):

```
supabase/migrations/00001_schema.sql
supabase/migrations/00002_mentions_and_replies.sql
supabase/migrations/00003_account_deletion.sql
supabase/migrations/00004_security_hardening.sql
supabase/migrations/00005_review_fixes.sql
```

They're idempotent, so re-running is safe. See [`DATABASE.md`](DATABASE.md) for what each adds. `00001` also creates the `avatars` and `post-images` storage buckets and their policies.

## 4. Configure Auth

- **Authentication → Providers**: enable **Email**.
- For dev convenience: **Authentication → Settings** → optionally turn **off** "Enable email confirmations" so signups log in immediately.
- Password reset / invite links use `NEXT_PUBLIC_APP_URL` — keep it matching your dev/prod origin.

## 5. Run

```bash
npm run dev            # http://localhost:3000
```

## Verify a change before you're done

```bash
npx tsc --noEmit       # types
npx eslint .           # lint (2 known pre-existing errors in theme.tsx / preference-toggle.tsx)
npx next build         # full build
```

You can't log in as a real user from the agent environment, so verification leans on the above plus a user spot-check in the running app.

## Notes

- Auth middleware is `proxy.ts` (Next.js 16 naming), not `middleware.ts`.
- After schema changes, keep `lib/types/database.ts` in sync.
- New to the codebase? Read [`ARCHITECTURE.md`](ARCHITECTURE.md), then [`../CLAUDE.md`](../CLAUDE.md) if you're an agent.
