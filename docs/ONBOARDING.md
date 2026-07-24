# ONBOARDING — Pre-launch reservation funnel

How the public, pre-launch "reserve your username" experience works: the animated funnel, the reserved access tier, the referral loop, the launch flag, and how to flip everything to "open" at launch.

Mazi is pre-launch. Instead of exposing the full app, the public face is an onboarding funnel that explains Mazi, captures interest signal, and ends in a **username reservation** (real account, but locked out of the app). See also [`ARCHITECTURE.md`](ARCHITECTURE.md) for how it sits in the app, [`SECURITY.md`](SECURITY.md) for the RLS gate, and [`DATABASE.md`](DATABASE.md) for the schema.

---

## The funnel — `/reserve`

Public route (`app/reserve/page.tsx` → `components/reserve/reserve-flow.tsx`), a client step-machine. Logged-in users are redirected out (`full` → `/home`, `reserved` → `/welcome`). Reads `?ref=<code>` for referral attribution.

Steps (fade-up panel transitions, thin accent progress bar):
1. **Intro / value prop** — what Mazi is; chronological · privacy-first · small communities.
2. **Survey** — "What wears you down about social media today?" multi-select (`components/reserve/survey-chips.tsx`) → `reasons[]`.
3. **Time slider** — daily minutes → an animated "time you could reclaim" counter (`time-slider.tsx` + `use-count-up` hook) per week/month/year.
4. **Reclaim** — "Regain your time, your data, your privacy" (shows the projected days/year from the slider).
5. **Pricing** — free during testing → paid later → a free week per friend invited (placeholder tiers, `pricing-cards.tsx`).
6. **Reserve** — username (live availability), email, password, age/terms consent → creates the reserved account.
7. **Invite / done** — referral link + "earn free weeks" (`invite-panel.tsx`).

All copy/numbers live in **`lib/reserve/config.ts`** (survey options, slider bounds, `RECLAIM_FACTOR`, pricing tiers, `launchMode()`). `RECLAIM_FACTOR` (default `0.6`) is illustrative — copy says "could reclaim," not a guarantee.

---

## Access tiers — `reserved` vs `full`

`profiles.access_level` (`00010`): `full` (default — every existing row + normal post-launch signup) or `reserved`.

A reserved account is a **real** Supabase account. It can log in and **edit its own profile**, but is blocked from the app:
- **RLS (the real boundary):** every "using the app" write policy requires `has_full_access()` — posts, comments, likes, follows, create/join community, and `accept_invite`. A reserved user calling PostgREST directly with its JWT + the anon key gets denied. See `SECURITY.md`.
- **UX layer:** the `(protected)` layout redirects `reserved` → `/welcome`; middleware keeps `/reserve` public and (in reservation mode) redirects `/signup` → `/reserve`.

The limited area is `app/(reserved)/`: `/welcome` (status + referral share + link to profile) and `/welcome/profile` (reuses `ProfileSettingsForm`).

---

## Reservation + referral data

`reservations` table (`00010`, 1:1 with a reserved profile): `reasons`, `daily_social_minutes`, `referral_code` (nanoid), `referred_by`. **No email** — it stays in `auth.users`.

Flow: `reserve()` (`lib/actions/reserve.ts`) generates the referral code, then `signUp` with everything in `options.data`. The `handle_new_user()` trigger reads that metadata and writes the profile (`reserved`) + reservation row atomically — so the reservation is recorded even if email confirmation is on and no session is issued.

- **Referral credit** is counted at **reservation time** (`get_referral_count()` counts rows whose `referred_by` = your code). One free week per referral is the promise; **actually granting weeks is a launch-time reconciliation** — not built yet.
- **Referral link:** `/reserve?ref=<referral_code>`.

### Reading the interest data

There's no admin UI. Read it in the **Supabase dashboard** (SQL editor), e.g.:
```sql
-- signups over time
select date_trunc('day', created_at) d, count(*) from reservations group by 1 order by 1;
-- what bothers people most
select unnest(reasons) reason, count(*) from reservations group by 1 order by 2 desc;
-- reported daily social minutes
select avg(daily_social_minutes), percentile_cont(0.5) within group (order by daily_social_minutes) from reservations;
-- referral leaderboard
select referred_by, count(*) from reservations where referred_by is not null group by 1 order by 2 desc;
```

---

## The launch flag

`NEXT_PUBLIC_LAUNCH_MODE` (read via `launchMode()` in `lib/reserve/config.ts`): `reservation` (default) or `open`.

- **`reservation`:** landing CTAs say "Reserve" → `/reserve`; `/signup` redirects to `/reserve`. `/login` stays open (existing testers).
- **`open`:** landing CTAs revert to "Sign up" → `/signup`; open registration works again.

Set it in `.env.local` (and the host's env). It's a `NEXT_PUBLIC_` var, so it's inlined at build — **rebuild/redeploy after changing it.**

**Two sources of truth (both required at launch):** `app_config.signup_mode` (DB, RLS-locked) is **authoritative for privilege** — the signup trigger reads it to decide `reserved` vs `full`, so it can't be bypassed by client metadata or a direct Auth call. `NEXT_PUBLIC_LAUNCH_MODE` (env) drives the **UI/routing** (landing CTAs, the `/signup`→`/reserve` redirect). Keep them in sync.

### Flip-to-open checklist (at launch)

1. **Make new signups full:** `update public.app_config set signup_mode = 'open';` (authoritative — without this, new accounts stay `reserved` even in "open" UI).
2. **Unlock existing reserved users:** `update profiles set access_level = 'full' where access_level = 'reserved';` (or a staged subset).
3. **Flip the UI:** set `NEXT_PUBLIC_LAUNCH_MODE=open` and redeploy.
4. Reconcile referral rewards from `reservations` (free weeks per confirmed `referred_by`) once billing exists.
5. (Optional) Email reserved users that their spot is open.

**Email confirmation → `/welcome`:** confirmation/recovery links go through the PKCE route `app/auth/callback/route.ts`, which exchanges the code for a session and forwards to `/welcome`. Add `NEXT_PUBLIC_APP_URL` (prod origin) to Supabase's Auth **redirect allowlist**, or the callback is rejected.

---

## Admin dashboard — `/admin/reservations`

An admin-only view of the waitlist (own route group `app/(admin)/`, wide chrome). Gated by the `admin_users` allowlist via `is_admin()`; non-admins get a 404 and the underlying RPCs raise. Shows: total/growth/confirmed/referred/avg-time stat cards, a collective "time reclaimed per year" headline, a 30-day signups bar chart, the "what draws them" reason breakdown, reported-time buckets, a referral leaderboard, and the full per-signup table with a **copy-all-emails** button for outreach. Data comes from `admin_reservation_stats()` + `admin_reservation_list()` (`lib/queries/admin.ts`); emails are joined from `auth.users` inside those definer RPCs and never exposed to non-admins.

**Seed the first admin** (once, in the Supabase SQL editor — this is a privilege grant, do it deliberately):
```sql
insert into public.admin_users (profile_id)
select p.id from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) = 'you@example.com'
on conflict do nothing;
```
You need a Mazi account first. Until an admin is seeded, `/admin/reservations` 404s.

## Setup notes / caveats

- **Migrations `00010` + `00011` are applied** on the live DB (2026-07-23, verified via MCP — see `DATABASE.md`). For a fresh setup, run them in order after `00009`.
- **Rate limiting is in place** — `reserve()` (5/IP/hr) and `checkUsername()` (90/IP/5min) call the DB-backed `rate_limit_hit`. A captcha is still worth adding before a large public push (`TODO.md`).
- **Password policy:** the Supabase project requires lower + upper + digit. `reserveSchema` mirrors this (8+ chars, upper/lower/digit) so users get clear guidance instead of a cryptic error on submit.
- **Email confirmation:** the reservation is captured either way (the trigger runs regardless). For a reserved user to get an *immediate* session and customize their profile, disable email confirmation during the reservation phase (or they confirm via the emailed link — `emailRedirectTo` sends them to `/welcome`). Whatever you pick, the default Supabase SMTP is heavily rate-limited — configure custom SMTP before a public push. Also enable leaked-password protection (advisor WARN) now that signup is public.
- **`NEXT_PUBLIC_APP_URL`** is `http://localhost:3000` in `.env.local`; referral links + the confirmation redirect use it. Set it to the prod domain before launch.
- **Placeholder pricing:** `PRICING` in `lib/reserve/config.ts` is marked "Planned / $TBD" — swap in real tiers before launch.
