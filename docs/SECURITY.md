# SECURITY

The security model for Mazi, a privacy-first app. Read this before changing anything touching data access, auth, storage, or migrations. Exhaustive schema/policy detail is in [`DATABASE.md`](DATABASE.md); rationale in [`DECISIONS.md`](DECISIONS.md).

> **No secrets in this repo.** All examples below use placeholders. Real project URLs/keys live only in the gitignored `.env.local` — never paste real values into docs, code, commits, or issues.

## Trust boundary

The browser holds the Supabase **anon key + the user's JWT** and can call the Postgres REST API **directly**. Therefore:

- **Row Level Security is the only real enforcement.** Server actions (`lib/actions/`) add validation and UX but can be bypassed by a direct API call. Never rely on them for access control.
- **There is no `service_role` key** in any client-reachable code, and there must not be — it bypasses RLS entirely.
- **Rule for new tables/columns:** enable RLS and write SELECT/INSERT/UPDATE/DELETE policies *in the same migration*. A table without policies is either fully open or fully closed — never ship that by accident.

## Secrets & configuration

- Config is env vars, all `NEXT_PUBLIC_*`:
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  ```
- `.env*` is gitignored (`.env.local` confirmed ignored). Keep it that way; do not add a committed `.env`.
- The anon key is *designed* to be shipped to browsers, but still treat project URL/keys as project data — keep them out of the repo and docs. Rotate keys in the Supabase dashboard if they ever land in git history.
- **Prohibited:** committing a `service_role` key, a database connection string, or any real key. If you need elevated DB work, the user runs it in the Supabase SQL editor.

## RLS policy map (effective after migration `00006`)

| Table | SELECT | INSERT | UPDATE / DELETE |
|-------|--------|--------|-----------------|
| `profiles` | any authenticated | own row (`auth.uid() = id`) | update own row; `email` column dropped (F4); `username` format `CHECK` (00008) |
| `posts` | own, non-community, or in a **public/joined** community (F5) | `author_id = auth.uid()` **and member if `community_id` set** (B) | update: author, membership re-checked for community posts (F/00006); delete: author **or** community mod/creator |
| `comments` | on visible posts (F5) | `author_id = auth.uid()` **and post is visible to caller** (F10) | update: author **and** post visible to caller (F/00006); delete: author **or** mod/creator |
| `likes` | on visible posts (F5) | `user_id = auth.uid()` **and post is visible to caller** (F10) | delete own |
| `follows` | any authenticated | `follower_id = auth.uid()` | delete own |
| `communities` | any authenticated | `creator_id = auth.uid()` | update/delete: creator |
| `community_members` | any authenticated | self-join **public** or bootstrap **creator** of own community (F1/F2); invite-only joins go through `accept_invite` | delete: self or mod/creator. **No UPDATE policy** → roles immutable (see moderator note) |
| `community_invites` | inviter or invitee only (F3) | mod/creator of the community | **No client UPDATE policy** (00006/A) → metadata immutable; the only transition is a targeted invitee declining via `decline_invite` |
| `notifications` | recipient only (`user_id = auth.uid()`) | `actor_id = auth.uid()` and F11 relationship checks; the `comment` branch also binds `comment_id.post_id = post_id` (00006/D) | update own (mark read) |

`comments.parent_id` is DB-enforced (trigger `comments_parent_integrity`, 00006/G) to reference a comment on the **same** `post_id` and never itself.

Storage (`avatars`, `post-images` buckets):

- Upload path's first segment must be the uploader's `auth.uid()` (F7).
- Filename extension must be a raster image (`jpg/jpeg/png/webp/gif`) and any declared `mimetype` must be an allowed image — **blocks `.svg`/`.html` stored-XSS** served from a public bucket. This lives at the RLS layer because the browser can upload directly with the anon key.
- These checks are enforced on **INSERT and UPDATE**. Avatar upload is an upsert (replaces the existing object via UPDATE); `00006/C` added the matching `WITH CHECK` so a replacement can't smuggle in an `.svg`/`.html` object. (`post-images` has no UPDATE policy and writes random paths, so no equivalent bypass.)

## `SECURITY DEFINER` functions

These run with elevated rights and each pin `search_path = public`:

- `handle_new_user()` — trigger on `auth.users` insert; creates the `profiles` row, collision-tolerant on username (F12).
- `delete_user()` — right-to-erasure; deletes only `auth.uid()`'s own auth user (cascades to all their data).
- `get_invite_by_token(token)` — resolves a shareable invite to public community fields, pending+unexpired only.
- `accept_invite(invite_id)` — validates + joins atomically; tokened links multi-use, targeted invites single-use **and accepted only from `pending`** so a removed member cannot rejoin (00006/E).
- `decline_invite(invite_id)` — the only invite-status transition open to a client. A **targeted** invitee declines their own **pending** invite; token links are not per-user declinable. Replaces the old broad invitee UPDATE policy (00006/A).

`enforce_comment_parent_integrity()` — `SECURITY DEFINER` trigger (not a client RPC) enforcing the `comments.parent_id` same-post / non-self rule (00006/G).

When adding a definer function: pin `search_path`, `revoke` from `public`/`anon`, `grant execute` to `authenticated`, and scope every action to `auth.uid()`.

## Input validation & integrity

- All user input is Zod-validated in `lib/validators/` **and** bounded by DB `CHECK` constraints (post ≤10k, comment ≤5k, bio ≤2k; `profiles.username` matches `^[a-zA-Z0-9_]{3,30}$`, 00008) so direct API writes can't store unbounded blobs or off-format handles (F9). Add both layers for new fields. The `username` `CHECK` also backs the notification `mention` RLS branch, which interpolates a handle into a regex and relies on it being `[a-zA-Z0-9_]` only.
- User-generated text renders through `RichText` (React nodes; `@mentions` become links). **Never** `dangerouslySetInnerHTML` on user content — that reintroduces XSS.

## Known notes / residuals

- **Notification spoofing** — F11 relationship-validates inserts; `00006/D` additionally binds the `comment` branch's `comment_id` to its `post_id`. When adding a notification type, add its RLS branch and consider migrating inserts to DB triggers to remove client inserts entirely.
- **Write-through on hidden posts** — closed by F10 (comment/like INSERT gated on post visibility) and extended by `00006/F` (the new comment UPDATE policy re-checks post visibility, so an edit can't relocate a comment onto a hidden post).
- **July 14 audit gaps** — **closed in `00006`** (applied + verified on the live DB 2026-07-15; see `DATABASE.md`). That migration: makes `community_invites` metadata immutable to clients (decline moves to `decline_invite`, so an invitee can no longer rewrite `community_id` and `accept_invite` elsewhere); requires membership for community post INSERT/UPDATE; adds the missing owner UPDATE policies for posts and comments; adds a WITH CHECK to the avatar Storage UPDATE mirroring the INSERT path/extension/MIME checks; binds comment notifications to the referenced comment's real post; enforces `comments.parent_id` same-post/non-self integrity via trigger; and restricts targeted-invite acceptance to `pending` only (no rejoin after removal).
- **Private image exposure** — `post-images` is currently a public bucket. Post RLS does not protect an uploaded image URL, including an image attached to an invite-only-community post. Move community-content images behind authorized delivery before representing them as private.
- **Legal placeholders** — `lib/legal/config.ts` contact/entity fields are not real; policy copy needs counsel review (not a code vuln, but a compliance gap).
- **Moderator role** is dormant (no assignment path) by design — see `DECISIONS.md` D9.

## Handling a security fix

1. Reproduce / confirm the gap against the **RLS layer**, not just the action.
2. Fix in a **new numbered migration** (idempotent), scoped tightly; keep legitimate flows working (notification inserts are best-effort, so a too-strict policy fails safe there — but comment/like/action inserts surface errors, so mirror existing read predicates exactly).
3. Log it in `DEVLOG.md`, note the manual-apply step, and update this file's policy map.
