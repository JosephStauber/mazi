# CLAUDE.md — Agent instructions for Mazi

Mazi is a minimalist, **privacy-first** social platform (Next.js 16 App Router · TypeScript · Tailwind v4 · Supabase w/ RLS · Zod). Chronological feeds only — no algorithm, no ads, no tracking, small communities.

You (a coding agent) are working in this repo. Read this file first, then follow it.

---

## Start here — read these before you touch code

Read the doc that matches your task; skim the rest. They live in [`docs/`](docs/):

| Doc | Read it when | What it holds |
|-----|--------------|---------------|
| [`docs/DEVLOG.md`](docs/DEVLOG.md) | **Always, first** | Reverse-chronological log of every change made to the project. Tells you what recently happened and why. |
| [`docs/TODO.md`](docs/TODO.md) | Planning / picking work | The backlog. Check before proposing new work — it may already be tracked or deliberately deferred. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Non-trivial code changes | How the app is wired: layers, data flow, routing, design system. |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Anything touching data access, auth, storage, RLS, or migrations | Trust model, per-table RLS map, storage/upload rules, secrets handling. |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Schema / migration work | Tables, columns, relationships, RPCs, triggers, indexes, migration order. |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Before reversing an approach | Why we work this way (ADR-style log). |
| [`docs/SETUP.md`](docs/SETUP.md) | First-time setup / env / migrations | Install, env config (placeholders), applying migrations, verify commands. |
| [`docs/ONBOARDING.md`](docs/ONBOARDING.md) | Pre-launch funnel / reservations / access tiers | The public `/reserve` funnel, `reserved` vs `full` access tiers, referral loop, the `NEXT_PUBLIC_LAUNCH_MODE` flag, and the flip-to-open-at-launch checklist. |
| [`README.md`](README.md) · [`PROJECT_OUTLINE.txt`](PROJECT_OUTLINE.txt) | Onboarding context only | **Partially stale** (predate the redesign + migrations 00002–00005). Trust the `docs/` set + the code over these until they're reconciled. |

---

## Non-negotiables

1. **RLS is the real security boundary, not the server actions.** The browser holds only the Supabase **anon key** + a user JWT and can call the DB directly. Never assume a server action gates access — every table's protection must hold at the Postgres RLS layer. There is **no `service_role` key** anywhere client-reachable; do not introduce one into app code.
2. **Migrations are applied by the user by hand** in the Supabase SQL editor — there is no Supabase CLI / local stack here. Write migrations as **new, numbered, idempotent** files in `supabase/migrations/` (`0000N_short_name.sql`). Never edit an already-applied migration to change behavior; add a new one. Say explicitly in your summary that a migration needs to be run.
3. **Don't commit secrets.** `.env.local` is gitignored and holds only public (`NEXT_PUBLIC_*`) keys. Keep it that way.
4. **Log what you did** in `docs/DEVLOG.md` and reconcile `docs/TODO.md` (see below) as part of finishing — not as an afterthought.
5. **Privacy-first is a product rule, not just a slogan.** No algorithmic ranking, no engagement manipulation, no third-party trackers/analytics without an explicit decision. Feeds stay strictly reverse-chronological.

---

## Project shape

Business logic lives in [`lib/`](lib/) and is deliberately decoupled from page components (so a future Expo app can reuse it):

- `lib/types/` — shared DB model types (`database.ts`). Keep in sync with the schema.
- `lib/validators/` — Zod schemas. Validate **all** user input here; mirror hard limits in DB `CHECK` constraints (client validation is bypassable).
- `lib/queries/` — **reads** (server-side). Pure data fetching.
- `lib/actions/` — **writes** (`"use server"` server actions). Auth-check, validate, mutate, `revalidatePath`.
- `lib/supabase/` — `client.ts` (browser), `server.ts` (RSC/actions), `middleware.ts` (session refresh, used by `proxy.ts`).
- `components/` — grouped by domain (`ui/`, `nav/`, `post/`, `comment/`, `feed/`, `community/`, `notification/`, `profile/`, `search/`, `settings/`, `legal/`).
- `app/` — App Router: `(auth)` public, `(protected)` authed, `legal/` public.

Note: the auth middleware file is **`proxy.ts`** (Next.js 16 naming), not `middleware.ts`.

## Conventions (match existing code)

- **Server action shape:** get user via `supabase.auth.getUser()` → `if (!user) return { error: "Not authenticated" }` → `ensureProfileForAuthUser(user)` where a profile FK is needed → Zod-parse → mutate → `revalidatePath(...)` → `return { success: true }`. Surface DB errors through `mapSupabaseUserMessage`.
- **Reads vs writes stay separated** — don't mutate from `lib/queries/`, don't fetch-for-render from `lib/actions/`.
- **Notification inserts are best-effort** (fire-and-forget) and gated by RLS (`00005`); never let a failed notification break the parent action.
- **Text rendering:** user text goes through `RichText` (React nodes, mentions → links). Never `dangerouslySetInnerHTML` on user content.
- **Design tokens** (Editorial Ink identity — warm paper, ink, single vermillion accent, Fraunces + Hanken Grotesk) are CSS variables in `app/globals.css`. Style through tokens, not hard-coded hex.
- TypeScript, no new runtime deps unless justified. Prefer the shortest correct diff; reuse what's there.

## Before you call a task done

```bash
npx tsc --noEmit      # types
npx eslint .          # lint (note: theme.tsx / preference-toggle.tsx have 2 pre-existing errors — not yours)
npx next build        # catches App Router / server-client boundary issues
```

- If your change has runtime surface, actually exercise it (or say clearly that you couldn't, and why — e.g. migration not yet applied). We **cannot** log in as a real user locally, so lean on build + typecheck + the user's spot-checks.
- On `main`? **Branch before committing.** Only commit/push when the user asks.

## Logging your work (this is the "memory" system)

When you finish a meaningful change, **prepend** an entry to [`docs/DEVLOG.md`](docs/DEVLOG.md) (newest on top) following the format in that file: date, what changed, why, files/migrations touched, and any follow-ups. Then update [`docs/TODO.md`](docs/TODO.md) — check off what you completed, add anything new you discovered or deferred.

## Standing product decisions

- **Moderator role is dormant by design.** `moderator` exists in the schema + RLS (post/comment delete, `canModerate` UI) but nothing can assign it yet — this is intentional (a promote feature is planned, tracked in `docs/TODO.md`). Do **not** "fix" it by ripping moderator support out.
