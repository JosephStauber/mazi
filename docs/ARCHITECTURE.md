# ARCHITECTURE

How Mazi is wired. This is the living overview — trust it over `README.md` / `PROJECT_OUTLINE.txt` (which are older). For schema specifics see [`DATABASE.md`](DATABASE.md); for the trust model see [`SECURITY.md`](SECURITY.md); for the "why" behind big choices see [`DECISIONS.md`](DECISIONS.md).

## Stack

- **Next.js 16** (App Router, React 19, Turbopack) · TypeScript
- **Tailwind CSS v4** — "Editorial Ink" design tokens in `app/globals.css`
- **Supabase** — Postgres + Auth + Storage, **Row Level Security** as the enforcement layer
- **Zod** — input validation · **nanoid** — invite/slug tokens
- Package manager: **npm**. No Supabase CLI / local stack (migrations applied by hand).

## The one big idea: RLS is the boundary

The browser runs the Supabase **anon key** + the user's JWT and can talk to Postgres directly. So **server actions are convenience, not security** — every access rule must hold at the RLS layer. There is no `service_role` key in any client-reachable code. This shapes everything below. Details in [`SECURITY.md`](SECURITY.md).

## Layers & data flow

```
Browser / RSC
   │
   ├── read  ──►  lib/queries/*   ──►  Supabase (RLS)   ──►  render
   │
   └── write ──►  lib/actions/*   ──►  Supabase (RLS)   ──►  revalidatePath
        (server actions:  auth-check → ensureProfile → Zod → mutate → revalidate)
```

- **`lib/queries/` = reads.** Server-side data fetching for pages. Pure; no mutations.
- **`lib/actions/` = writes.** `"use server"` actions. Standard shape: `getUser()` → bail if none → `ensureProfileForAuthUser` (when a profile FK is needed) → Zod-parse → mutate → `revalidatePath` → `{ success }` / `{ error }`. DB errors mapped via `mapSupabaseUserMessage`.
- **`lib/validators/` = Zod schemas.** All user input validated here; hard limits mirrored as DB `CHECK` constraints (client validation is bypassable).
- **`lib/types/database.ts`** = shared model types, kept in sync with the schema.
- **`lib/supabase/`** = `client.ts` (browser), `server.ts` (RSC/actions, cookie-bound), `middleware.ts` (session refresh, driven by root `proxy.ts`).

Business logic in `lib/` is deliberately decoupled from page components so a future Expo app can reuse `types` / `validators` / `queries` / `actions` with only the client swapped.

## Auth & routing

- **`proxy.ts`** (root) runs `lib/supabase/middleware.ts` on every matched request: refreshes the session and redirects unauthenticated users away from protected routes, and signed-in users away from `/login` `/signup`. (Next.js 16 names this file `proxy.ts`, not `middleware.ts`.)
- Route groups under `app/`:
  - `(auth)/` — `/login`, `/signup` (public)
  - `(protected)/` — everything authed: `home`, `profile/[username]` (+ `followers`/`following`), `communities` (+ `[slug]`, `join`), `compose`, `post/[id]`, `notifications`, `search`, `settings` (+ `profile`)
  - `legal/` — `/legal/{privacy,terms,guidelines,cookies}` (public)
  - top-level: `page.tsx` (landing), `layout.tsx`, `error.tsx`, `not-found.tsx`

## Components

Grouped by domain under `components/`: `ui/` (primitives — Button, Input, Avatar, Modal, RichText, MentionTextarea, Toast, …), `nav/`, `post/`, `comment/`, `feed/`, `community/`, `notification/`, `profile/`, `search/`, `settings/`, `legal/`. Client components only where interactivity is required; everything else is a server component.

## Feed model

- **Following feed** (`home`): personal (non-community) posts from users you follow, reverse-chronological, keyset-paginated by `created_at` (`InfiniteFeed` + `loadMore*` actions, page size 15).
- **Community feed**: posts in communities you belong to (or one filtered community).
- Engagement counts (`likes_count`, `comments_count`) are computed **in Postgres** via PostgREST embedded aggregates (`likes(count), comments(count)`); `enrichPosts` adds only the caller's own like state. No ranking, ever.

## Design system — "Editorial Ink"

Warm paper background, rich ink text, a single vermillion accent, **Fraunces** (display/headings) + **Hanken Grotesk** (body), faint paper-grain overlay. All colors/spacing/radii are CSS variables in `app/globals.css`; fonts wired in `app/layout.tsx`. **Style through tokens, not hard-coded hex.** (This supersedes the earlier black-and-white aesthetic — see `DECISIONS.md`.)

## Database & migrations

Nine tables, all RLS-enabled, plus storage buckets, triggers, and `SECURITY DEFINER` RPCs. Migrations live in `supabase/migrations/` and are applied **in order, by hand** in the Supabase SQL editor: `00001` schema → `00002` mentions/replies → `00003` account deletion → `00004` security hardening → `00005` review fixes. Full reference in [`DATABASE.md`](DATABASE.md).

## Build & verify

```bash
npm run dev            # local dev
npx tsc --noEmit       # types
npx eslint .           # lint
npx next build         # full build / boundary check
```

No real-user login is available locally, so correctness leans on build + typecheck + user spot-checks.
