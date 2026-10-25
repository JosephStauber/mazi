# ONBOARDING — Pre-launch reservation funnel

How the public, pre-launch "reserve your username" experience works: the animated funnel, the reserved access tier, the referral loop, the launch flag, and how to flip everything to "open" at launch.

Mazi is pre-launch. Instead of exposing the full app, the public face is an onboarding funnel that explains Mazi, captures interest signal, and ends in a **username reservation** (real account, but locked out of the app). See also [`ARCHITECTURE.md`](ARCHITECTURE.md) for how it sits in the app, [`SECURITY.md`](SECURITY.md) for the access-tier gate, and [`DATABASE.md`](DATABASE.md) for the schema.

---

## The funnel — `/reserve`

Public route (`app/reserve/page.tsx` → `components/reserve/reserve-flow.tsx`), a client step-machine. Logged-in users are redirected out (`full` → `/home`, `reserved` → `/welcome`). Reads `?ref=<code>` for referral attribution.

Steps (fade-up panel transitions, thin accent progress bar):
1. **Intro / value prop** — what Mazi is; chronological · privacy-first · small communities.
2. **Survey** — "What wears you down about social media today?" multi-select (`components/reserve/survey-chips.tsx`) → `reasons[]`.
3. **Time slider** — daily minutes → an animated "time you could reclaim" counter (`time-slider.tsx` + `use-count-up` hook) per week/month/year.
4. **Reclaim** — "Regain your time, your data, your privacy" (shows the projected days/year from the slider).
5. **Pricing** — free during testing → paid later → a free week per friend invited (placeholder tiers, `pricing-cards.tsx`).
6. **Reserve** — username (live availability), email, password, age/terms consent → creates the reserved account and sends a confirmation email.
7. **Check your inbox** — the referral link appears on `/welcome` after the user confirms their email (`invite-panel.tsx`).

All copy/numbers live in **`lib/reserve/config.ts`** (survey options, slider bounds, `RECLAIM_FACTOR`, pricing tiers, `launchMode()`). `RECLAIM_FACTOR` (default `0.6`) is illustrative — copy says "could reclaim," not a guarantee.

---

## Access tiers — `reserved` vs `full`

`profiles.accessLevel`: `full` or `reserved`, set by the signup trigger from `appConfig.signupMode` (never from client input).

A reserved account is a **real** Better Auth account. It can log in and **edit its own profile**, but is blocked from the app:
- **Convex functions (the real boundary):** every "using the app" query and mutation calls `requireFullAccess` (`convex/lib/access.ts`) and throws for reserved accounts — feeds, posts, comments, likes, follows, communities, invites, notifications, search. See `SECURITY.md`.
- **UX layer:** the `(protected)` layout redirects `reserved` → `/welcome`; `proxy.ts` keeps `/reserve` public and (in reservation mode) redirects `/signup` → `/reserve`.

The limited area is `app/(reserved)/`: `/welcome` (status + referral share + link to profile) and `/welcome/profile` (reuses `ProfileSettingsForm`).

---

## Reservation + referral data

`reservations` table (1:1 with a reserved profile): `reasons`, `dailySocialMinutes`, `referralCode`, `referredBy`. **No email** — it stays in the Better Auth `user` table.

Flow: `ReserveFlow` validates with `reserveSchema`, then calls Better Auth `signUp.email` with the survey + referral packed in `signupMeta` (JSON). The `user.onCreate` trigger (`createProfileForAuthUser`, `convex/lib/accounts.ts`) sanitizes it and writes the profile (`reserved`) + reservation (with a fresh referral code) in the same transaction as the user — so the reservation exists even before the email is confirmed. The confirmation link signs the user in and lands on `/welcome`.

- **Referral credit:** `reservations:mine` counts reservations whose `referredBy` is your code **and whose email is confirmed**. One free week per referral is the promise; **actually granting weeks is a launch-time reconciliation** — not built yet.
- **Referral link:** `/reserve?ref=<referralCode>`.

### Reading the interest data

Use the admin dashboard (below), or browse the `reservations` table in the Convex dashboard (Data tab).

---

## The launch flag

`NEXT_PUBLIC_LAUNCH_MODE` (read via `launchMode()` in `lib/reserve/config.ts`): `reservation` (default) or `open`.

- **`reservation`:** landing CTAs say "Reserve" → `/reserve`; `/signup` redirects to `/reserve`. `/login` stays open (existing testers).
- **`open`:** landing CTAs revert to "Sign up" → `/signup`; open registration works again.

Set it in `.env.local` (and the host's env). It's a `NEXT_PUBLIC_` var, so it's inlined at build — **rebuild/redeploy after changing it.**

**Two sources of truth (both required at launch):** `appConfig.signupMode` (Convex, server-only) is **authoritative for privilege** — the signup trigger reads it to decide `reserved` vs `full`, so it can't be bypassed by client input or a direct call to the auth API. `NEXT_PUBLIC_LAUNCH_MODE` (env) drives the **UI/routing** (landing CTAs, the `/signup`→`/reserve` redirect). Keep them in sync.

### Flip-to-open checklist (at launch)

1. **Make new signups full + unlock reserved users:** `npx convex run --prod admin:setSignupMode '{"mode":"open","promoteReserved":true}'` (promotes up to 1000 per call — repeat until none are left). Without the mode change, new accounts stay `reserved` even in "open" UI.
2. (Staged rollout instead? Run it with just `{"mode":"open"}` and promote accounts separately.)
3. **Flip the UI:** set `NEXT_PUBLIC_LAUNCH_MODE=open` and redeploy.
4. Reconcile referral rewards from `reservations` (free weeks per confirmed `referred_by`) once billing exists.
5. (Optional) Email reserved users that their spot is open.

**Email confirmation → `/welcome`:** the emailed link hits Better Auth's `/api/auth/verify-email`, which verifies, signs the user in, and redirects to the `callbackURL` (`/welcome` from the funnel, `/home` from `/signup`). `SITE_URL` on the Convex deployment must be the production origin or links point at the wrong host.

---

## Admin dashboard — `/admin/reservations`

An admin-only view of the waitlist (own route group `app/(admin)/`, wide chrome), live-updating. Gated by the `adminUsers` allowlist: non-admins get a 404 from the layout and the `admin:*` queries throw. Shows: total/growth/confirmed/referred/avg-time stat cards, a collective "time reclaimed per year" headline, a 30-day signups bar chart, the "what draws them" reason breakdown, reported-time buckets, a referral leaderboard, and the per-signup table (100 rows at a time, more load on scroll) with a **copy-emails** button for the rows loaded. Data comes from `admin:reservationStats` (precomputed counters — see `DATABASE.md`) + `admin:reservationList` (paginated) in `convex/admin.ts`; `reservationList` is the only function that returns emails.

**Seed the first admin** (once — this is a privilege grant, do it deliberately; you need a Mazi account first):
```bash
npx convex run admin:grant '{"username":"your_handle"}'
```
Add `--prod` for the production deployment. Until an admin is seeded, `/admin/reservations` 404s.

## Setup notes / caveats

- **Rate limiting:** Better Auth's database-backed limiter caps sign-ups at 10/IP/hour (and sign-ins, reset and verification emails). `profiles:usernameAvailable` is not rate-limited (boolean only). A captcha is still worth adding before a large public push (`TODO.md`).
- **Password policy:** 8+ chars with upper/lower/digit (`passwordSchema`), enforced by a Better Auth hook on sign-up and reset — the form hints match.
- **Email:** confirmation is required. Set `RESEND_API_KEY` + a verified-domain `RESEND_FROM` on the deployment before any public push; without a key, links only appear in the Convex logs.
- **`SITE_URL`** (Convex env) and **`NEXT_PUBLIC_APP_URL`** must be the production origin before launch — auth redirects, passkeys, and referral links use them.
- **Placeholder pricing:** `PRICING` in `lib/reserve/config.ts` — swap in real tiers before launch.
