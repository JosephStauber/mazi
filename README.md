# Mazi

A minimalist, privacy-first social platform. No algorithm. No ads. Just people.

- **Chronological feeds only** — the people you follow and the communities you joined, newest first. No ranking, no suggested posts.
- **Privacy-first** — no ads, no trackers, no profiling. Analytics are cookieless page-type counts only (see `docs/DECISIONS.md` D15).
- **Small communities** — public or invite-only, with members, invites, and moderation.

## Stack

- **Next.js 16** (App Router) + TypeScript, **Tailwind CSS v4** ("Editorial Ink" tokens in `app/globals.css`)
- **Convex** — database, server functions, file storage, live queries
- **Better Auth** (Convex component) — email + password with verification, passkeys, Google/Apple when configured
- **Resend** — auth email
- **Zod** — shared validation on client and server

## Quick start

```bash
npm install
npx convex dev   # backend: pushes convex/, writes .env.local, tails logs
npm run dev      # app on http://localhost:3000
```

Then set the backend env vars (`SITE_URL`, `BETTER_AUTH_SECRET`, …) and finish `.env.local` as described in [`docs/SETUP.md`](docs/SETUP.md). Without a Resend key, confirmation and reset links are printed in the `npx convex dev` logs, so local sign-up works out of the box.

## Docs

| Doc | What's in it |
|-----|--------------|
| [`docs/SETUP.md`](docs/SETUP.md) | Install, env vars, local + production deploys |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How the app is wired: layers, routing, data flow, design system |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Trust model — every public Convex function is a security boundary |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Convex tables, indexes, counters, cascades |
| [`docs/ONBOARDING.md`](docs/ONBOARDING.md) | Pre-launch reservation funnel and the launch checklist |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Why things are the way they are |
| [`docs/DEVLOG.md`](docs/DEVLOG.md) · [`docs/TODO.md`](docs/TODO.md) | What changed, and what's next |

Working on the code (human or agent)? Start with [`CLAUDE.md`](CLAUDE.md).

## Checks

```bash
npx tsc --noEmit
npx eslint .
npx next build
```
