# DATABASE

Schema reference, kept next to the migrations in `supabase/migrations/`. Reflects state through `00006`. Access rules summarized here; the full policy map + trust model is in [`SECURITY.md`](SECURITY.md).

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

> **Live-DB state (2026-07-15, applied + verified via MCP):** `00001`–`00008` are all applied. On 2026-07-15 the live DB had only `00001`–`00004`; `00005`, `00006`, `00007` were applied via the Supabase MCP connection and verified (policies/RPCs/trigger/indexes present). `00008` was then applied via the same MCP connection and verified: constraint `profiles_username_format` present (`NOT VALID`, enforced on writes — a bad-handle UPDATE is rejected), and `accept_invite(uuid)` EXECUTE is granted to `authenticated` only (not `public`/`anon`). `00009` (mention-notification post binding) was then applied via the same MCP connection on 2026-07-22 and verified: the notifications INSERT policy now carries the `c.post_id = notifications.post_id` binding in **both** the `comment` and `mention` branches, and the row is recorded in `supabase_migrations.schema_migrations`.

## Tables

All have RLS enabled. `id` is `uuid` PK (default `gen_random_uuid()`) unless noted; timestamps are `timestamptz default now()`.

### `profiles`
`id` (PK → `auth.users.id`, cascade) · `username` (unique, not null) · `bio` · `avatar_url` · `created_at`
- `email` column was **removed** in `00004` (redundant with `auth.users`; column-level RLS isn't a thing).
- `bio` bounded `≤ 2000` chars (`00004`).
- `username` format `CHECK (~ '^[a-zA-Z0-9_]{3,30}$')` (`00008`, `NOT VALID`) — mirrors the Zod rule at the DB so a direct PostgREST `PATCH` can't set an off-format handle, and backs the notification `mention` regex's `[a-zA-Z0-9_]` assumption.
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

## Relationships (cascade deletes)

Deleting an `auth.users` row cascades → `profiles` → all of that user's `posts`, `comments`, `likes`, `follows`, `community_members`, `notifications`. Deleting a `community` cascades to its members, invites, and posts. Deleting a `post` cascades to its comments and likes. This is what makes `delete_user()` a clean erasure.

## Functions / RPCs (`SECURITY DEFINER`, `search_path = public`)

- **`handle_new_user()`** — trigger `on_auth_user_created` (after insert on `auth.users`). Inserts the profile; sanitizes + de-duplicates username on collision (`00005` F12).
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
