# DATABASE

Schema reference, kept next to the migrations in `supabase/migrations/`. Reflects state through `00011`. Access rules summarized here; the full policy map + trust model is in [`SECURITY.md`](SECURITY.md).

## Migration order (apply by hand, in order)

| File | What it adds |
|------|--------------|
| `00001_schema.sql` | All tables, indexes, base RLS, storage buckets + policies, `handle_new_user` trigger |
| `00002_mentions_and_replies.sql` | `comments.parent_id` (nested replies); `mention` notification type |
| `00003_account_deletion.sql` | `delete_user()` RPC (right to erasure) |
| `00004_security_hardening.sql` | F1–F9: membership-gated reads, invite RPCs, drop `profiles.email`, storage MIME/path checks, length `CHECK`s, locked `search_path` |
| `00005_review_fixes.sql` | F10–F13: comment/like visibility gating, notification relationship checks, collision-tolerant signup trigger, multi-use invite links |
| `00006_rls_integrity_fixes.sql` | July 14 audit follow-up (A–G): immutable invite metadata + `decline_invite` RPC, membership-gated post INSERT/UPDATE, owner UPDATE policies for posts & comments, comment→post notification binding, `parent_id` same-post trigger, targeted-invite accept only from `pending`, avatar Storage UPDATE parity |
| `00007_pagination_indexes.sql` | Composite indexes backing keyset pagination: `posts(author_id, created_at desc)`, `posts(community_id, created_at desc)`, `comments(post_id, created_at)`, `comments(author_id)`, `community_members(community_id, created_at)`, `follows(following_id, created_at desc)`, `follows(follower_id, created_at desc)`, `notifications(user_id, created_at desc)`. Index-only ADDs — no schema/RLS change. |
| `00008_username_check_and_grants.sql` | `profiles.username` format `CHECK (~ '^[a-zA-Z0-9_]{3,30}$')` (added `NOT VALID` so a manual apply can't fail on legacy rows; enforced on all future writes); re-asserts `accept_invite(uuid)` execute grant (defense-in-depth — 00005/00006 redefined it via `CREATE OR REPLACE`). Applied 2026-07-15. |
| `00009_mention_notification_post_binding.sql` | Re-creates the notifications INSERT policy, adding `c.post_id = notifications.post_id` to the `mention` comment sub-branch (00006/D bound the `comment` type but not the `mention`-of-a-comment case, so a real @mention notification could be relinked to an unrelated post). Every other branch verbatim. Applied 2026-07-22. |
| `00010_reservations_and_access_tiers.sql` | Pre-launch onboarding funnel data layer: `profiles.access_level` (`reserved`\|`full`, default `full`); `reservations` table (survey + referral graph) + owner-only RLS; `has_full_access()` gate added to every "using the app" write policy (posts/comments/likes/follows/create-or-join community) + `accept_invite`; `username_available()` (anon) + `get_referral_count()` RPCs; `rate_limits` table + `rate_limit_hit()` (anon, DB-backed throttle); `handle_new_user()` extended to record reservation metadata at signup; PUBLIC execute revoked from the internal/trigger functions. Applied 2026-07-23. See [`ONBOARDING.md`](ONBOARDING.md). |
| `00011_admin_reservation_dashboard.sql` | Admin-only reservation dashboard: `admin_users` allowlist (RLS-locked, no policies); `is_admin()`; `admin_reservation_stats()` (aggregate JSON) + `admin_reservation_list()` (per-signup rows incl. email from `auth.users`) — SECURITY DEFINER, each raises unless `is_admin()`. Applied 2026-07-23. Admin allowlist seeded out-of-band (not in the migration). |
| `00012_reservation_security_hardening.sql` | Codex-review hardening. `profiles` table-level INSERT/UPDATE revoked from `authenticated` (only `username,bio,avatar_url` granted → `access_level` client-non-writable); `app_config.signup_mode` (RLS-locked) drives the tier in `handle_new_user` (not client metadata); **restrictive** SELECT + update/delete/notification/invite/storage tier gates so reserved users can't read or write the app; `rate_limit_hit` redesigned to `(action, key)` with server-fixed limits + hashed key; trigger sanitizes reasons (canonical set) + clamps minutes + drops self-referrals; `unique(lower(username))`; `reservations` client INSERT dropped; `get_referral_count` confirmed-only; `accept_invite`/`decline_invite` row-locked; admin stats null-safe + zero-filled buckets. Applied 2026-07-23. |

> **Live-DB state (2026-07-23, applied + verified via MCP):** `00001`–`00011` are all applied. `00001`–`00009` per prior entries. `00010` + `00011` applied 2026-07-23 via the Supabase MCP and verified: `profiles.access_level` present (all existing rows `full`); the 6 app-write INSERT policies carry `has_full_access()`; a simulated reserved user's `insert into posts` is denied by RLS; the signup trigger records `reserved` profile + `reservations` row (+ referral FK) — proven with synthetic `auth.users` inserts that were then deleted. Grants confirmed: only `username_available` + `rate_limit_hit` are anon-executable; `has_full_access`/`get_referral_count`/`is_admin`/the two admin RPCs are `authenticated`-only; `handle_new_user` is trigger-only (no RPC execute). The admin RPC guard fails closed (raises `Not authorized` without an admin JWT).

## Tables

All have RLS enabled. `id` is `uuid` PK (default `gen_random_uuid()`) unless noted; timestamps are `timestamptz default now()`.

### `profiles`
`id` (PK → `auth.users.id`, cascade) · `username` (unique, not null) · `bio` · `avatar_url` · `created_at`
- `email` column was **removed** in `00004` (redundant with `auth.users`; column-level RLS isn't a thing).
- `bio` bounded `≤ 2000` chars (`00004`).
- `username` format `CHECK (~ '^[a-zA-Z0-9_]{3,30}$')` (`00008`, `NOT VALID`) — mirrors the Zod rule at the DB so a direct PostgREST `PATCH` can't set an off-format handle, and backs the notification `mention` regex's `[a-zA-Z0-9_]` assumption.
- `access_level` (`reserved` | `full`, not null, default `full`; `00010`) — pre-launch tier. `full` = normal (existing rows + post-launch signups). `reserved` = pre-launch reservation: can edit its own profile but is blocked from every app write by `has_full_access()` (see `SECURITY.md`). Set to `reserved` by `handle_new_user()` when the signup carries reservation metadata.
- Auto-created on signup by `handle_new_user()`.

### `communities`
`id` · `name` · `slug` (unique) · `description` · `creator_id` (→ profiles) · `privacy_type` (`public` | `invite_only`) · `created_at`

### `community_members`
`id` · `community_id` · `user_id` · `role` (`member` | `moderator` | `creator`, default `member`) · `created_at` · **unique(`community_id`, `user_id`)**
- **No UPDATE policy** → roles are immutable after insert. `moderator` has no assignment path yet (dormant by design — `DECISIONS.md` D9).

### `community_invites`
`id` · `community_id` · `inviter_id` · `invitee_id` (nullable) · `token` (unique, nullable) · `status` (`pending`|`accepted`|`declined`|`expired`) · `expires_at` (nullable) · `created_at`
- Targeted invite = `invitee_id` set, `token` null. Shareable link = `token` set, `invitee_id` null.
- Rows are inviter/invitee-readable only; links resolve via `get_invite_by_token`.
- Metadata is immutable to clients: `00006` dropped the invitee UPDATE policy. The only client-driven transition is a targeted invitee declining a pending invite via `decline_invite`; acceptance runs inside `accept_invite`.

### `posts`
`id` · `author_id` (→ profiles) · `content` (not null, `≤ 10000`) · `image_url` · `community_id` (nullable → communities) · `created_at`
- `00006`: INSERT requires membership when `community_id` is non-null; owner-only UPDATE policy added (WITH CHECK re-checks membership for community posts).

### `comments`
`id` · `post_id` · `author_id` · `content` (not null, `≤ 5000`) · `parent_id` (nullable, self-ref → comments, cascade; added `00002`) · `created_at`
- `00006`: trigger `comments_parent_integrity` enforces that `parent_id` references a comment on the same `post_id` and rejects self-parenting; owner-only UPDATE policy added (WITH CHECK mirrors the F10 post-visibility predicate).

### `likes`
`id` · `post_id` · `user_id` · `created_at` · **unique(`post_id`, `user_id`)**

### `follows`
`id` · `follower_id` · `following_id` · `created_at` · **unique(`follower_id`, `following_id`)**

### `notifications`
- Insert requires `actor_id = auth.uid()` and F11 checks a relationship per type (`00005`); `00006` binds the `comment` branch's `comment_id` to the same `post_id` (`post_id is not null and c.post_id = notifications.post_id`).

### `reservations` (`00010`)
`profile_id` (PK → profiles, cascade) · `reasons` (`text[]`, ≤ 12) · `daily_social_minutes` (`int`, 0–1440, nullable) · `referral_code` (unique, not null) · `referred_by` (nullable → `reservations.referral_code`, `on delete set null`) · `created_at`
- One row per `reserved` account: the onboarding survey answers + the referral graph. **No email column** — email lives only in `auth.users` (see `00004`).
- RLS: **owner-only** `select`/`insert` (`auth.uid() = profile_id`); no `anon`. Referral counts are read via the `get_referral_count()` definer RPC, never by selecting others' rows.
- Written by `handle_new_user()` at signup (definer), not by a direct client insert.

### `rate_limits` (`00010`)
`id` · `bucket` · `key` · `created_at`. RLS enabled, **no policies** — clients never touch it; only the definer `rate_limit_hit()` reads/writes it. Backs the anon-reachable reserve funnel's throttle (per-IP `reserve` + `username_check` buckets). Opportunistic per-key cleanup keeps it bounded.

### `admin_users` (`00011`)
`profile_id` (PK → profiles, cascade) · `created_at`. RLS enabled, **no policies** — read only by `is_admin()` (definer). The dashboard allowlist; seed by inserting the owner's `profile_id` out-of-band.

### `app_config` (`00012`)
Single row (`id boolean pk` = true) · `signup_mode` (`reservation`|`open`, default `reservation`) · `updated_at`. RLS enabled, **no policies** — read only by the signup trigger (definer). **Authoritative** for the access tier new accounts get: the trigger sets `reserved` vs `full` from this, never from client metadata. At launch, `update app_config set signup_mode='open'` (and separately set `NEXT_PUBLIC_LAUNCH_MODE=open` for the UI).

## Relationships (cascade deletes)

Deleting an `auth.users` row cascades → `profiles` → all of that user's `posts`, `comments`, `likes`, `follows`, `community_members`, `notifications`. Deleting a `community` cascades to its members, invites, and posts. Deleting a `post` cascades to its comments and likes. This is what makes `delete_user()` a clean erasure.

## Functions / RPCs (`SECURITY DEFINER`, `search_path = public`)

- **`handle_new_user()`** — trigger `on_auth_user_created` (after insert on `auth.users`). Inserts the profile; sanitizes + de-duplicates username on collision (`00005` F12). `00010`: when `raw_user_meta_data->>'reservation' = 'true'`, creates the profile as `access_level = 'reserved'` and inserts the `reservations` row (survey + referral) atomically — so a reservation is recorded regardless of whether email confirmation is on.
- **`has_full_access()`** (`00010`) — returns whether `auth.uid()`'s profile is `access_level = 'full'` (missing profile / `reserved` → false). Used in the write-side RLS policies + inside `accept_invite` to lock `reserved` accounts out of the app. `execute` granted to `authenticated`.
- **`username_available(p_username text)`** (`00010`) — case-insensitive availability check for the reservation funnel (reserved names are real profiles, so it covers them). `execute` granted to **`anon`** + `authenticated`; reads nothing but a boolean.
- **`get_referral_count()`** (`00010`) — how many reservations the caller has referred (`referred_by` = caller's own `referral_code`). `execute` granted to `authenticated` (PUBLIC/anon revoked).
- **`rate_limit_hit(bucket, key, max, window_seconds)`** (`00010`) — DB-backed sliding-window throttle. Records a hit and returns `false` once `key` reaches `max` within `window_seconds`. **Fails open** (returns true) on any internal error. `execute` granted to `anon` + `authenticated`.
- **`is_admin()`** (`00011`) — whether `auth.uid()` is in `admin_users`. `execute` `authenticated` only.
- **`admin_reservation_stats()`** (`00011`) — aggregate dashboard metrics as one JSONB (totals/growth, reason breakdown, minute distribution, referral leaderboard, confirmed/customized counts). Raises `Not authorized` unless `is_admin()`. `authenticated` only.
- **`admin_reservation_list()`** (`00011`) — per-signup rows **including email** (joined from `auth.users`) + referral counts, newest first (≤ 2000). Raises unless `is_admin()`. This is the only path that exposes reservation emails to a client. `authenticated` only.
- **Grant note (`00010`/`00011`):** Postgres grants EXECUTE to PUBLIC by default. `has_full_access`, `get_referral_count`, `is_admin`, and the two admin RPCs have PUBLIC/anon revoked (`authenticated` only); `handle_new_user` (trigger-only) has all execute revoked. Only `username_available` + `rate_limit_hit` remain anon-callable, by design.
- **`delete_user()`** — deletes `auth.uid()`'s own auth user. `execute` granted to `authenticated` only.
- **`get_invite_by_token(p_token text)`** — returns public community fields for a `pending`, unexpired invite.
- **`accept_invite(p_invite_id uuid)`** — validates status/expiry/targeting, inserts membership `on conflict do nothing`, returns `community_id`. Tokened links stay reusable; targeted invites flip to `accepted` and (`00006` E) are acceptable **only from `pending`**, so re-accepting an already-`accepted` invite (rejoin after removal) is rejected.
- **`decline_invite(p_invite_id uuid)`** (`00006`) — a targeted invitee declines their own `pending` invite (`status → declined`). Rejects token links and non-invitee callers. `execute` granted to `authenticated` only. Replaces the dropped invitee UPDATE policy.
- **`enforce_comment_parent_integrity()`** (`00006`) — `SECURITY DEFINER` trigger function backing `comments_parent_integrity` (before insert/update on `comments`); requires `parent_id`'s post to equal the row's `post_id` and forbids self-parenting.

## Storage buckets

- `avatars`, `post-images` — both are currently public buckets, so object downloads bypass Storage RLS. This may be acceptable for avatars but not for private-community post images.
- Upload policies: first path segment = uploader's `auth.uid()`; extension + declared MIME must be an allowed raster image (`jpg/jpeg/png/webp/gif`). Blocks SVG/HTML stored-XSS. Avatar path is `{{uid}}/avatar.{{ext}}` (upsert); post images `{{uid}}/{{uuid}}.{{ext}}`.
- `00006`: the avatar UPDATE policy now carries a `WITH CHECK` repeating the path/extension/MIME checks (avatar upsert replaces via UPDATE, which previously skipped them). `post-images` has no UPDATE policy.
- Current follow-up required: public buckets bypass object-download RLS, so `post-images` leaks invite-only-community media to anyone with its URL (still open — separate TODO item).

## Indexes

On the hot foreign keys and sort columns (`00001`): `posts(author_id)`, `posts(community_id)`, `posts(created_at desc)`, `comments(post_id)`, `comments(parent_id)`, `likes(post_id)`, `likes(user_id)`, `follows(follower_id)`, `follows(following_id)`, `community_members(community_id)`, `community_members(user_id)`, `community_invites(token)`, `community_invites(invitee_id)`, `notifications(user_id)`, `notifications(user_id, read)`, `profiles(username)`.

Composite `(filter_col, created_at)` indexes for keyset pagination (`00007`): `posts(author_id, created_at desc)`, `posts(community_id, created_at desc)`, `comments(post_id, created_at)`, `comments(author_id)`, `community_members(community_id, created_at)`, `follows(following_id, created_at desc)`, `follows(follower_id, created_at desc)`, `notifications(user_id, created_at desc)`. Each serves one paginated list (equality/IN on the leading column, ordered range on `created_at`, `LIMIT`); the `id` tiebreaker is a cheap in-timestamp sort and isn't indexed.

Current performance follow-up: the `00007` composites supersede several `00001` single-column indexes for these paths (`idx_posts_author`, `idx_posts_community`, `idx_comments_post`, `idx_follows_follower`, `idx_follows_following`, `idx_community_members_community`, `idx_notifications_user`). Dropping the now-redundant ones is deferred pending `pg_stat_user_indexes` review in production. The explicit `profiles(username)` and `community_invites(token)` indexes may also duplicate unique-constraint indexes; confirm actual index names and usage before dropping.

## Conventions for schema changes

- New numbered, **idempotent** migration (`drop policy if exists` before `create`, `add column if not exists`, `create or replace function`). Never edit an applied file.
- Add RLS policies in the same migration as the table/column.
- Mirror any user-facing length/format limit as a DB `CHECK` (client validation is bypassable).
- Update `lib/types/database.ts`, this file, and `SECURITY.md`'s policy map together.
