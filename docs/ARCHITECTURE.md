# ARCHITECTURE

How Mazi is wired. This is the living overview — trust it over `README.md` / `PROJECT_OUTLINE.txt` (which are older). For schema specifics see [`DATABASE.md`](DATABASE.md); for the trust model see [`SECURITY.md`](SECURITY.md); for the "why" behind big choices see [`DECISIONS.md`](DECISIONS.md).

## Stack

- **Next.js 16** (App Router, React 19, Turbopack) · TypeScript
- **Tailwind CSS v4** — "Editorial Ink" design tokens in `app/globals.css`
- **Convex** — database, server functions, file storage, live queries
- **Better Auth** (via `@convex-dev/better-auth`) — email + password, passkeys, Google/Apple (dormant until configured)
- **Resend** (via `@convex-dev/resend`) — transactional auth email
- **Zod** — input validation, shared by the forms and the Convex functions
- Package manager: **npm**

## The one big idea: every Convex function is a boundary

The browser calls Convex functions directly. There's no row-level security underneath, so each public query/mutation enforces its own access rules through `convex/lib/access.ts`. Pages, layouts, and `proxy.ts` only shape the UX. Details in [`SECURITY.md`](SECURITY.md).

## Layers & data flow

```
Browser (client components)
   ├── useQuery / usePaginatedList ──► convex/*.ts queries  ──► live updates pushed back
   └── useMutation                 ──► convex/*.ts mutations (access check → Zod → write → notify)

Next.js server
   ├── layouts: fetchAuthQuery(api.profiles.me) → redirect by tier (UX)
   ├── /api/auth/[...all]   → proxies Better Auth to Convex HTTP actions
   └── /api/images/[postId] → re-checks access as the viewer, streams the image
```

- **`convex/`** — the backend. One module per area (`posts`, `comments`, `feed`, `profiles`, `follows`, `communities`, `notifications`, `search`, `reservations`, `admin`, `account`, `files`), plus:
  - `auth.ts` (Better Auth config + user triggers), `auth.config.ts` (JWT provider — required), `http.ts` (auth routes), `email.ts` (Resend), `betterAuth/` (local-install auth component + generated schema)
  - `lib/access.ts` (all access rules), `lib/dto.ts` (docs → UI shapes), `lib/returns.ts` (return validators), `lib/cascade.ts` (deletes + counters), `lib/accounts.ts` (signup/erasure triggers), `lib/notify.ts`, `lib/signup.ts`, `lib/validate.ts`
- **`lib/`** (shared) — `types/database.ts` (UI wire shapes), `validators/` (Zod, used on both sides), `reserve/config.ts`, `utils/` (`errors.ts`, `upload.ts`, `mentions.ts`, `image.ts`, …), `hooks/use-paginated-list.ts`, `auth-client.ts` (browser Better Auth client), `auth-server.ts` (Next.js server helpers).
- **Reads are live.** Feeds, comments, notifications, profiles, and the unread badge are subscriptions: other people's posts, likes, and edits appear without a refresh. Small optimistic overrides (like, follow, join) bridge the gap while a mutation is in flight, then defer to the live value.

The backend is framework-agnostic, so a future Expo app can call the same Convex functions with the Convex React client + Better Auth's Expo client.

## Auth & routing

- **`proxy.ts`** (Next.js 16's middleware) checks only that a Better Auth session cookie *exists* and redirects anonymous users off protected routes; in reservation mode it also sends `/signup` to `/reserve`. It doesn't validate the session (no round trip).
- **Server layouts** validate for real: `(protected)` fetches `profiles.me` and redirects to `/login` or `/welcome` (reserved); `(reserved)` bounces full users to `/home`; `(admin)` 404s non-admins.
- **Root layout** passes the session's Convex JWT to `ConvexClientProvider` so the first client render is already authenticated.
- Route groups under `app/`:
  - `(auth)/` — `/login`, `/signup`, `/forgot-password`, `/reset-password` (public)
  - `(protected)/` — `home`, `profile/[username]` (+ `followers`/`following`), `communities` (+ `[slug]`, `join`), `compose`, `post/[id]`, `notifications`, `search`, `settings` (+ `profile`)
  - `(reserved)/` — `/welcome` (+ `profile`) for pre-launch accounts
  - `(admin)/` — `/admin/reservations`
  - `reserve/` — the public pre-launch funnel; `legal/` — public policies
  - `api/auth/[...all]` (Better Auth proxy), `api/images/[postId]` (private post images)

## Components

Grouped by domain under `components/`: `ui/`, `nav/` (incl. `app-shell.tsx`), `providers/` (`convex-client-provider.tsx`, `viewer.tsx` — the signed-in profile for client components), `auth/`, `post/`, `comment/`, `feed/`, `community/`, `notification/`, `profile/`, `search/`, `settings/` (incl. `passkey-settings.tsx`), `reserve/`, `admin/`, `legal/`. Pages that read data are client components using Convex hooks.

## Feed model

- **Following feed** (`home`): personal posts from people you follow, newest first — merged per-author index streams (`convex/feed.ts`), 15 per page, infinite scroll.
- **Communities feed**: posts in your communities (or one filtered community), same merge technique.
- Counts are denormalized on the documents (`likeCount`, `commentCount`, …) and kept correct by the mutations. No ranking, ever.

## Design system — "Editorial Ink"

Warm paper background, rich ink text, a single vermillion accent, **Fraunces** + **Hanken Grotesk**, faint paper-grain overlay. All colors/spacing/radii are CSS variables in `app/globals.css`. **Style through tokens, not hard-coded hex.**

## Build & verify

```bash
npx convex dev         # backend: pushes functions + schema, tails logs
npm run dev            # frontend
npx tsc --noEmit       # types (also covers convex/)
npx eslint .           # lint
npx next build         # full build / boundary check
```

Unlike the Supabase setup, you **can** sign up and log in locally: without a Resend key, confirmation links are printed in the `npx convex dev` logs.
