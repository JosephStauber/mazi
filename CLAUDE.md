# CLAUDE.md — Agent instructions for Mazi

Mazi is a minimalist, **privacy-first** social platform (Next.js 16 App Router · TypeScript · Tailwind v4 · Convex · Better Auth · Resend · Zod). Chronological feeds only — no algorithm, no ads, no tracking, small communities.

You (a coding agent) are working in this repo. Read this file first, then follow it.

---

## Start here — read these before you touch code

Read the doc that matches your task; skim the rest. They live in [`docs/`](docs/):

| Doc | Read it when | What it holds |
|-----|--------------|---------------|
| [`docs/DEVLOG.md`](docs/DEVLOG.md) | **Always, first** | Reverse-chronological log of every change made to the project. Tells you what recently happened and why. |
| [`docs/TODO.md`](docs/TODO.md) | Planning / picking work | The backlog. Check before proposing new work — it may already be tracked or deliberately deferred. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Non-trivial code changes | How the app is wired: layers, data flow, routing, design system. |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Anything touching data access, auth, storage, or Convex functions | Trust model, per-area access rules, upload rules, secrets handling. |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Schema work | Convex tables, indexes, counters, auth triggers, cascades, feed pagination. |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Before reversing an approach | Why we work this way (ADR-style log). |
| [`docs/SETUP.md`](docs/SETUP.md) | First-time setup / env | Install, Convex + Better Auth + Resend env (placeholders), verify commands. |
| [`docs/ONBOARDING.md`](docs/ONBOARDING.md) | Pre-launch funnel / reservations / access tiers | The public `/reserve` funnel, `reserved` vs `full` access tiers, referral loop, the `NEXT_PUBLIC_LAUNCH_MODE` flag, and the flip-to-open-at-launch checklist. |
| [`README.md`](README.md) · [`PROJECT_OUTLINE.txt`](PROJECT_OUTLINE.txt) | Onboarding context only | **Stale** (predate the redesign and the move to Convex). Trust the `docs/` set + the code over these until they're reconciled. |

---

## Non-negotiables

1. **Every public Convex function is a security boundary.** There is no RLS: the browser can call any public query/mutation with any arguments. Each one must start with the right check from `convex/lib/access.ts` (`requireViewer`, `requireFullAccess`, `requireVisiblePost`, `getMembership`, `canModeratePost`, …). Identity comes **only** from `ctx.auth` — never take "who am I" as an argument. Privileged operations go in `internalQuery`/`internalMutation` (CLI/dashboard only). Put new rules in `access.ts`, not inline.
2. **Secrets live on the Convex deployment** (`npx convex env set NAME=value`), never in the repo or `.env.local` (which holds only public `NEXT_PUBLIC_*` URLs + `CONVEX_DEPLOYMENT` and is gitignored). Don't commit secrets.
3. **Schema is code** (`convex/schema.ts`); `npx convex dev` pushes it. A change that needs existing data rewritten on a live deployment needs a migration — say so explicitly in your summary. Don't hand-edit `convex/betterAuth/generatedSchema.ts`; regenerate it (see `docs/DATABASE.md`).
4. **Log what you did** in `docs/DEVLOG.md` and reconcile `docs/TODO.md` (see below) as part of finishing — not as an afterthought.
5. **Privacy-first is a product rule, not just a slogan.** No algorithmic ranking, no engagement manipulation, no third-party trackers/analytics without an explicit decision. Feeds stay strictly reverse-chronological.

---

## Project shape

- `convex/` — the backend. One module per area (`posts`, `comments`, `feed`, `profiles`, `follows`, `communities`, `notifications`, `search`, `reservations`, `admin`, `account`, `files`); `auth.ts` (Better Auth config + user triggers), `auth.config.ts`, `http.ts`, `email.ts` (Resend); `betterAuth/` (auth component, generated schema); `lib/` (`access.ts` rules, `dto.ts` doc→UI shapes, `returns.ts` return validators, `cascade.ts` deletes + counters, `accounts.ts` signup/erasure, `notify.ts`, `validate.ts`).
- `lib/` (shared, framework-agnostic where practical) — `types/database.ts` (UI wire shapes; keep in sync with `convex/lib/dto.ts` + `returns.ts`), `validators/` (Zod — run on the client for UX **and** on the server via `parseOrDeny`), `auth-client.ts` / `auth-server.ts`, `hooks/use-paginated-list.ts`, `utils/`.
- `components/` — grouped by domain (`ui/`, `nav/`, `providers/`, `auth/`, `post/`, `comment/`, `feed/`, `community/`, `notification/`, `profile/`, `search/`, `settings/`, `reserve/`, `admin/`, `legal/`).
- `app/` — App Router: `(auth)` public, `(protected)` full users, `(reserved)` pre-launch accounts, `(admin)`, `reserve/`, `legal/`, `api/auth/[...all]` (Better Auth proxy), `api/images/[postId]` (private post images).

Note: the route guard is **`proxy.ts`** (Next.js 16 naming), not `middleware.ts`. It only checks that a session cookie exists; server layouts and Convex functions do the real checks.

## Conventions (match existing code)

- **Mutation shape:** `const viewer = await requireFullAccess(ctx)` (or `requireViewer` for things reserved accounts may do) → load + authorize the target (`requireVisiblePost`, membership, ownership) → `parseOrDeny(zodSchema, value)` → write → keep counters right with `bump` → `notify(...)` if it causes a notification. Declare `args` and `returns` validators.
- **Errors:** throw `deny("user-safe message")` (a `ConvexError`); the client shows it with `errorMessage(e)`. Never leak internals in messages.
- **Queries return DTOs** (snake_case, ISO dates, `id`) via `convex/lib/dto.ts`, with a matching validator from `convex/lib/returns.ts`. Paginated lists take `paginationOptsValidator` and are consumed with `usePaginatedList`.
- **Reads are live:** client components use `useQuery` / `usePaginatedList`; don't add server-side data fetching for render except the tier gates in layouts (`fetchAuthQuery`). Optimistic state should only bridge an in-flight mutation and then defer to the live value.
- **Notifications** are written only server-side, inside the mutation that causes them (`convex/lib/notify.ts`).
- **Uploads:** `files:generateUploadUrl` → POST the file → pass the storage id to a mutation that calls `claimImage`. Post images are only ever rendered through `/api/images/[postId]`.
- **Text rendering:** user text goes through `RichText` (React nodes, mentions → links). Never `dangerouslySetInnerHTML` on user content.
- **Design tokens** (Editorial Ink identity — warm paper, ink, single vermillion accent, Fraunces + Hanken Grotesk) are CSS variables in `app/globals.css`. Style through tokens, not hard-coded hex.
- TypeScript, no new runtime deps unless justified. Prefer the shortest correct diff; reuse what's there.

## Before you call a task done

```bash
npx tsc --noEmit      # types (includes convex/)
npx eslint .          # lint
npx next build        # catches App Router / server-client boundary issues
```

- If your change has runtime surface, actually exercise it: run `npx convex dev` + `npm run dev` and use the app (local sign-up works; without `RESEND_API_KEY`, confirmation links are printed in the Convex logs). If you couldn't, say so and why.
- On `main`? **Branch before committing.** Only commit/push when the user asks.

## Logging your work (this is the "memory" system)

When you finish a meaningful change, **prepend** an entry to [`docs/DEVLOG.md`](docs/DEVLOG.md) (newest on top) following the format in that file: date, what changed, why, files/migrations touched, and any follow-ups. Then update [`docs/TODO.md`](docs/TODO.md) — check off what you completed, add anything new you discovered or deferred.

## Standing product decisions

- **Moderator role is dormant by design.** `moderator` exists in the schema + access rules (post/comment delete, `canModerate` UI) but nothing can assign it yet — this is intentional (a promote feature is planned, tracked in `docs/TODO.md`). Do **not** "fix" it by ripping moderator support out.
