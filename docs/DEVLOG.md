# DEVLOG — Change log

The running memory of the project. **Every meaningful change gets an entry**, newest first. This is how the next agent (or you, later) knows what happened and why without re-reading the whole diff history.

**How to add an entry:** prepend a new block at the top of the "Entries" section using the template below. Keep it tight — a few lines. Date format `YYYY-MM-DD`. Mark migrations that still need to be applied. When you commit, reference the commit if useful.

```md
## YYYY-MM-DD — Short title
**By:** <agent name / human>
**Summary:** One or two sentences on what changed.
**Changed:** key files / `supabase/migrations/000NN_*.sql`
**Why:** The reason / trigger.
**Follow-ups:** anything left open (also add to docs/TODO.md), or "none".
```

---

## Entries

## 2026-07-15 — Pre-merge review fixes (username CHECK, invite-RPC grant, doc drift)
**By:** Claude (agent)
**Summary:** Closed the three residual findings from the pre-merge review of the uncommitted security/pagination/perf work. All non-blocking, all low-severity, but each is a real DB-layer or accuracy gap.
- **`profiles.username` had no DB constraint.** The `^[a-zA-Z0-9_]{3,30}$` rule lived only in Zod (`lib/validators/profile.ts`) + the signup trigger's sanitizer — both bypassable by a direct `PATCH /rest/v1/profiles` on the caller's own row (RLS allows own-row UPDATE). The notification `mention` RLS branch (00005/00006) interpolates `pr.username` into a `~` regex and *asserts* handles are `[a-zA-Z0-9_]` only, with nothing backing it. New migration `00008` adds the `CHECK` (as `NOT VALID` so a manual apply can't fail on any legacy row; still fully enforced on all future INSERT/UPDATE — the actual attack vector). Also fixed the one code path that could emit an out-of-format handle: `ensureProfileForAuthUser`'s collision fallback `u_${nanoid(10)}` (nanoid's default alphabet includes `-`) now strips `-`.
- **`accept_invite(uuid)` grant not re-asserted.** 00005/00006 redefined it via `CREATE OR REPLACE` (which preserves 00004's `revoke public,anon` / `grant authenticated`), so it's correct in practice, but the files aren't self-contained — a fresh create would default EXECUTE to PUBLIC. `00008` re-asserts the grant idempotently (matching what `decline_invite` already does in 00006).
- **Doc drift.** `SECURITY.md` still called the 00006 audit fixes "(needs manual apply)" though `DATABASE.md`/`TODO.md` record 00005–00007 applied+verified 2026-07-15. Corrected, and documented the new `username` `CHECK` in `SECURITY.md` (policy map + input-validation section) and `DATABASE.md` (migration table, `profiles` section, live-DB state).
**Changed:** `supabase/migrations/00008_username_check_and_grants.sql` (new, **pending manual apply**), `lib/queries/profiles.ts` (nanoid fallback), `docs/SECURITY.md`, `docs/DATABASE.md`, `docs/TODO.md`.
**Why:** Back the notification-regex security assumption at the DB, make the invite-RPC ACL self-contained, and keep the docs honest about applied state.
**Verify:** `npx tsc --noEmit`, `npx eslint .`, `npx next build` all pass; `git diff --check` clean. Migration `00008` **not** applied yet (no local Supabase; user applies by hand after `00007`). After applying, spot-check: a direct authenticated `PATCH /rest/v1/profiles?id=eq.<self>` setting `username` to `"a b"` / `"a.b"` / a 40-char string → **rejected** (check violation); a normal `[a-zA-Z0-9_]{3,30}` handle → succeeds. `NOT VALID` can be upgraded with `ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_username_format;` once legacy data is confirmed clean.
**Follow-ups:** none new. Still open elsewhere: private `post-images` bucket; drop redundant single-column indexes after prod review. Uncommitted at time of writing.

## 2026-07-15 — Performance pass (memoized user reads, parallelized reads, leaner payloads)
**By:** Claude (agent)
**Summary:** Shipped the remaining confirmed performance items with minimal behavior change and no new deps.
- **Request-memoized user reads.** New `getAuthUser` and a rewritten `getCurrentUser` are wrapped in React `cache()` (per-request only — no cross-request cache of session/RLS data). The protected layout now reads `getAuthUser()` once and runs `Promise.all([getCurrentUser(), getUnreadCount(user.id)])`, so the layout **and** the page it wraps share a single `getUser()` + single `profiles` read (was one of each in the layout *and* again in the page = 2×), and the unread count overlaps the profile read instead of following it.
- **Parallelized independent reads.** Profile / followers / following pages load viewer + viewed profile together; the post-detail page loads the post and its first comment page together; `createComment` reads post-author + parent-author in parallel and fires its comment-notification inserts alongside the mention fan-out. Authorization-dependent steps stay sequential; notifications stay best-effort.
- **Leaner embedded selects.** Replaced `author:profiles!author_id(*)` / member `profile(*)` / notification actor `select("*")` with `(id, username, avatar_url)`, and follower/following lists with `(id, username, avatar_url, bio)` — the exact rendered fields, dropping `bio`+`created_at` (and more) from every feed/comment/member/notification row. Added `ProfileRef` / `ProfileListItem` types; `PostWithAuthor.author`, `CommentWithAuthor.author`, `CommunityMemberWithProfile.profile`, `NotificationWithActor.actor`, and `UserPage` now use them.
- **Mention search fan-out fixed.** `MentionTextarea` stored each debounce cleanup but discarded it, so fast typing fired one `profiles` query per keystroke. Now the timer lives in a ref, is cleared before each schedule and on unmount/close (request-ID guard kept); the lookup also selects only `(id, username, avatar_url)`.
- **Server-rendered settings data.** The settings menu email and the edit-profile initial profile are now server-rendered (`getAuthUser` / `getCurrentUser`) and passed in as props; removed the browser `auth.getUser()` + `profiles` round trips (`SettingsMenu` no longer uses the browser client; edit-profile form split into a server page + new `profile-settings-form.tsx` client leaf).
- **Long-feed rendering.** `PostCard` is `React.memo` (a "load more" append no longer re-renders every mounted card) and each card's `<article>` uses `content-visibility:auto` + `contain-intrinsic-size:auto 320px` so off-screen cards skip render/layout. Chose this over evicting loaded pages (which breaks scroll-up) and over a static/interactive server-client split of the card (inline edit + image double-tap-like entangle the "static" body — a broader redesign, deliberately deferred).
**Changed:** `lib/queries/profiles.ts` (cache, `getAuthUser`, narrowed follower/following), `lib/queries/{feed,posts,communities,notifications}.ts` (narrowed selects), `lib/types/database.ts` (`ProfileRef`/`ProfileListItem`), `lib/actions/comment.ts` (parallel notif reads/writes), `app/(protected)/layout.tsx`, `app/(protected)/{profile/[username],profile/[username]/followers,profile/[username]/following,post/[id]}/page.tsx`, `app/(protected)/settings/page.tsx`, `app/(protected)/settings/profile/page.tsx`, `components/settings/settings-menu.tsx`, `components/settings/profile-settings-form.tsx` (new), `components/ui/mention-textarea.tsx`, `components/post/post-card.tsx`, `components/profile/user-list.tsx`, `docs/TODO.md`. No schema/migration change.
**Why:** Close the open "Reduce redundant reads / personalized payload / parallelize / mention fan-out" TODO items without weakening RLS/authorization or best-effort notifications.
**Verify:** `npx tsc --noEmit`, `npx eslint .` (0 problems), and `npx next build` all pass. Runtime not exercised against a live session (no local auth) — lean on typecheck/build + user spot-checks. Spot-check suggestions: mention autocomplete fires one request per pause (Network tab); a growing feed doesn't re-render old cards (React Profiler); settings + edit-profile show data on first paint; comment on a post that @mentions the post author still yields exactly one notification (no double-up).
**Follow-ups:** none new. Still open elsewhere in TODO: private `post-images` bucket; drop redundant single-column indexes after prod review. Uncommitted at time of writing.

## 2026-07-15 — Mazi wordmark favicon
**By:** OpenCode (agent)
**Summary:** Added a scalable favicon based on the supplied Mazi mark: rounded warm-paper tile, black serif m, and vermillion period. Generated matching ICO and Apple touch-icon fallbacks from that source.
**Changed:** `app/icon.svg`, `app/favicon.ico`, `app/apple-icon.png`; removed the unselected `public/favicon-options.svg` preview; `docs/DEVLOG.md`; `docs/TODO.md`.
**Why:** Establish a browser icon consistent with the selected Mazi wordmark and Editorial Ink identity.
**Follow-ups:** none.

## 2026-07-14 — Keyset pagination for every growing collection (migration 00007)
**By:** Claude (agent)
**Summary:** Replaced unbounded list reads and timestamp-only feed cursors with opaque `(created_at, id)` keyset pagination across the app; feeds stay strictly reverse-chronological and all reads stay behind RLS. New `lib/utils/cursor.ts` encodes an opaque base64url `created_at|id` token and emits the lexicographic PostgREST `.or()` predicate (`created_at.lt.T,and(created_at.eq.T,id.lt.ID)` for desc, `.gt` for asc), paired with `.order(created_at).order(id)` and a `LIMIT n+1` "is there more?" probe — so rows sharing a boundary timestamp are never skipped or duplicated. New shared client hook `lib/hooks/use-infinite-list.ts` (callback-ref sentinel → survives tab mount/unmount, re-arms per page). **Paginated:** following feed + communities feed (`lib/queries/feed.ts`), profile posts + post comments (`lib/queries/posts.ts` — comments page by *root*, each root's direct replies loaded with it so threads stay intact), community posts + members (`lib/queries/communities.ts`), followers/following (`lib/queries/profiles.ts`). **Completed the `/communities` feed:** it now renders `InfiniteFeed` with a working load-more (was first-15-only). **Redundant-read cuts:** `getCommunities` counts via an embedded `community_members(count)` aggregate instead of transferring every member row; the communities page passes the member ids it already read into `getCommunitiesFeed` (no second `community_members` query on that request); follow-state lists use a bounded `getFollowedSubset(ids)` instead of loading the caller's entire follow set. Load-more server actions live in the new `lib/actions/pagination.ts` (+ the two feed ones in `lib/actions/feed.ts`). Migration `00007_pagination_indexes.sql` adds the composite indexes for these shapes. Did **not** add any cross-request cache for cookie-bound RLS reads.
**Pagination API changes (for consumers):** `getFollowingFeed` / `getCommunitiesFeed` / `getPostsByUser` / `getCommunityPosts` / `getPostComments` / `getCommunityMembers` / `getFollowers` / `getFollowingProfiles` now return `Page<T> = { items, nextCursor }` and take an optional trailing `cursor`. `getCommunitiesFeed(userId, filterId?, cursor?, memberIds?)` gained `memberIds` to skip its membership re-read. Added `getPostCountByUser` (profile header/tab total) and `getFollowedSubset`; removed `getFollowingIdSet`. `getCommunitiesFeed`'s load-more action arg order is now `(communityId, cursor)` for `.bind`. New `Page<T>` / `UserPage` types in `lib/types/database.ts`. Client components (`InfiniteFeed`, `ProfileTabs`, `CommunityTabs`, `UserList`, `CommentList`) now take `initial*` + `initialCursor` + a `loadMore` action prop.
**Indexes added (00007, pending manual apply):** `posts(author_id, created_at desc)`, `posts(community_id, created_at desc)`, `comments(post_id, created_at)`, `comments(author_id)`, `community_members(community_id, created_at)`, `follows(following_id, created_at desc)`, `follows(follower_id, created_at desc)`, `notifications(user_id, created_at desc)`. Index-only ADDs; the composites supersede several `00001` single-column indexes (dropping the redundant ones is deferred to a prod `pg_stat_user_indexes` review — see TODO).
**Changed:** `lib/utils/cursor.ts` (new), `lib/hooks/use-infinite-list.ts` (new), `lib/actions/pagination.ts` (new), `supabase/migrations/00007_pagination_indexes.sql` (**applied to the live DB 2026-07-15**, see below), `lib/queries/{feed,posts,communities,profiles}.ts`, `lib/actions/feed.ts`, `lib/types/database.ts`, `components/feed/infinite-feed.tsx`, `components/profile/{profile-tabs,user-list}.tsx`, `components/community/community-tabs.tsx`, `components/comment/comment-list.tsx`, `app/(protected)/{home,communities,communities/[slug],post/[id],profile/[username],profile/[username]/followers,profile/[username]/following}/page.tsx`, `docs/DATABASE.md`, `docs/TODO.md`.
**Applied (2026-07-15, live Mazi project `hnkvgwizhlbdkugmwtef`, via Supabase MCP):** On inspection the live DB had only `00001`–`00004`; `00005`/`00006` were still unapplied. Applied, in order and at the user's request: **`00007`** (8 pagination indexes — all verified in `pg_indexes`), then the two pending security migrations **`00005`** (F10–F13) and **`00006`** (A–G). Post-apply verification confirmed all now active: `decline_invite` + `accept_invite` present, `comments_parent_integrity` trigger present, comment/like visibility insert policies, owner UPDATE policies on posts & comments, the tightened notification insert policy, the dropped `"Invitee can update invite status"` policy, and the avatar Storage UPDATE `WITH CHECK`. `supabase_migrations` was previously empty (schema had been applied by hand); these three now appear there. Security advisor after apply: only pre-existing/by-design warnings — public `avatars`/`post-images` bucket listing (already a TODO), the intended invite/delete SECURITY DEFINER RPCs (granted to `authenticated` on purpose), trigger functions `handle_new_user`/`enforce_comment_parent_integrity` callable via RPC (benign — Postgres rejects direct calls to trigger functions), and Auth leaked-password protection disabled (auth config, not schema).
**Why:** Stop server + client memory growing with the data (feeds, profiles, community members, comment threads, follow lists) and close the timestamp-cursor gap where two posts sharing a `created_at` at a page boundary could be skipped.
**Verify:** `npx tsc --noEmit`, `npx eslint .` (exit 0), and `npx next build` all pass. Cursor logic exercised in isolation (`lib/utils/cursor.ts`): base64url round-trips a real `…+00:00` timestamp, url-safe token, null/garbage cursors → first page, correct desc/asc `.or()` strings, `LIMIT n+1` → next-cursor set / exact-page → null. Runtime list scrolling not exercised against a live session (no local auth); lean on build/typecheck + user spot-checks. Known minor limitation: the profile Media tab derives from loaded posts (grows as the Posts tab scrolls).
**Follow-ups:** `00005`, `00006`, `00007` are all applied to the live DB (above). Because the RLS changes can't be smoke-tested locally (no auth), spot-check on the live app: post to a community you're a member of vs one you aren't; comment/like on a public-community post; decline an invite (now via `decline_invite`); edit your own post/comment; a reply must stay on the same post. Still open (TODO): `getCurrentUser` request-scoped `cache()` + parallel unread-count; drop the now-redundant single-column indexes after prod review; make `post-images` a private bucket. Code uncommitted at time of writing.

## 2026-07-14 — Application correctness fixes (export, optimistic state, markup, lint)
**By:** Claude (agent)
**Summary:** Fixed the confirmed non-migration correctness defects. (1) **GDPR export** — `exportMyData` now fails safely (surfaces the first query error via `mapSupabaseUserMessage` instead of turning failures into empty arrays) and includes the previously omitted `notifications`, `invites_sent`, `invites_received`, and `communities_created`. (2) **Optimistic comments** — `createComment` returns the persisted `{ id, created_at }`; `CommentList` swaps the `temp-*` item for it in both `submitTopLevel` and `addReply`, so a new comment is immediately editable/deletable/replyable without reload. (3) **Like errors** — `toggleLike` now surfaces the DELETE error; `PostCard.applyLike` rolls back on a resolved `{ error }` (not only on a thrown rejection). (4) **Composer** — `PostComposer` requires non-empty text before submit, matching `createPostSchema` (no more image-only submit that fails after upload). (5) **Markup/a11y** — home CTAs became `Link`s styled by a new exported `buttonClassName` (no `<a><button>` nesting); the post body no longer wraps `RichText` in a `Link` (timestamp is the post link, so mention links aren't nested anchors); the post image is a `<button aria-label>` (keyboard Enter/Space likes via `e.detail === 0`; pointer keeps double-tap). Added `aria-label`s to the invite-username input, community name/description, composer community select, and preference switches, and associated the community privacy `<select>` with its label. (6) **Lint gate restored** — `join/page.tsx` derives the no-token error (only async setState left in its effect); `cookie-notice.tsx` / `preference-toggle.tsx` / `theme.tsx` read localStorage & `matchMedia` via `useSyncExternalStore` (theme derives `resolved`, effect only writes the DOM class, first-commit guarded so the pre-paint script isn't fought during hydration); `search-view.tsx` moved all setState into its debounce timers; unused `currentUser` prop removed from `CommentRow`.
**Changed:** `lib/actions/account.ts`, `lib/actions/comment.ts`, `lib/actions/post.ts`, `components/comment/comment-list.tsx`, `components/post/post-card.tsx`, `components/post/post-composer.tsx`, `components/community/invite-panel.tsx`, `components/community/create-community-form.tsx`, `components/settings/preference-toggle.tsx`, `components/legal/cookie-notice.tsx`, `components/search/search-view.tsx`, `components/ui/theme.tsx`, `components/ui/button.tsx` (new `buttonClassName` export), `app/(protected)/home/page.tsx`. No schema/migration change.
**Why:** Close the July 14 review's confirmed application-layer defects (data-portability completeness, optimistic-UI regressions, error handling, invalid/inaccessible markup) and get `npx eslint .` back to zero problems.
**Verify:** `npx eslint .` → clean. `npx tsc --noEmit` + `npx next build` passed for this changeset in isolation. (Heads-up: a separate in-progress pagination change — new `lib/actions/pagination.ts`, `lib/utils/cursor.ts`, `Page<T>` return types across `lib/queries/*` — was landing in the working tree concurrently and left shared feed/consumer pages mid-migration; those files are **not** part of this change.)
**Follow-ups:** none for these items. Runtime paths (comment post, like toggle, export download, theme toggle) not exercised against a live session — no local auth — so lean on typecheck/build/lint plus the user's spot-checks.

## 2026-07-14 — RLS / integrity audit fixes (migration 00006)
**By:** Claude (agent)
**Summary:** New migration `00006_rls_integrity_fixes.sql` closes the seven confirmed July 14 RLS/integrity defects: (A) `community_invites` metadata is now immutable to clients — dropped the broad invitee UPDATE policy and moved decline to a narrow `decline_invite` SECURITY DEFINER RPC, so a named invitee can no longer PATCH `community_id`/token/status and `accept_invite()` into a different private community; (B) `posts` INSERT now requires membership when `community_id` is set; (F) added the missing owner UPDATE policies for `posts` (WITH CHECK re-checks membership) and `comments` (WITH CHECK mirrors the F10 post-visibility predicate); (G) added trigger `comments_parent_integrity` requiring `parent_id` to share `post_id` and rejecting self-parenting; (D) tightened the notifications `comment` branch to bind `comment_id.post_id = post_id`; (E) `accept_invite` accepts targeted invites only from `pending` (no rejoin after removal); (C) avatar Storage UPDATE now carries a WITH CHECK repeating the path/extension/MIME raster checks (avatar upsert replaces via UPDATE, which previously skipped them). Code: `declineInvite` now calls the `decline_invite` RPC instead of a direct UPDATE.
**Changed:** `supabase/migrations/00006_rls_integrity_fixes.sql` (**needs manual apply, after 00005**), `lib/actions/community.ts` (declineInvite → RPC), `docs/SECURITY.md`, `docs/DATABASE.md`, `docs/TODO.md`. `lib/types/database.ts` unchanged (no table/column shape change; Supabase clients are untyped so the new RPC needs no generated type).
**Why:** Close the private-community access + integrity gaps documented in the July 14 review before further feature work; RLS is the real boundary since the browser calls PostgREST directly.
**Verify (direct authenticated PostgREST / RPC, not just UI):**
- A (invite tamper): as invitee, `PATCH /rest/v1/community_invites?id=eq.<id>` setting `community_id` → **0 rows / blocked** (no UPDATE policy). `rpc/decline_invite` on your own pending targeted invite → declined; on a token invite or someone else's → error.
- B (community post): `POST /rest/v1/posts` with a `community_id` you're **not** a member of → **blocked**; as a member → **succeeds**; `community_id = null` → succeeds.
- C (avatar XSS): upsert `PUT` to `avatars/<uid>/avatar.svg` (or `metadata.mimetype = image/svg+xml`) → **blocked**; `avatar.png` as image/png → succeeds.
- D (notif binding): `POST /rest/v1/notifications` type=`comment` with `comment_id` from post P1 but `post_id` = P2 → **blocked**; a genuine comment notification (comment on the same post) → succeeds.
- E (rejoin): accept a targeted invite, leave/get removed, call `rpc/accept_invite` again → **error** (status is `accepted`, not `pending`). Token-link second-person accept → still succeeds.
- F (edits): `PATCH /rest/v1/posts` / `comments` on your own row → **succeeds**; on another user's row → **0 rows**.
- G (parent integrity): `POST /rest/v1/comments` with `parent_id` on a different `post_id`, or `parent_id = id` → **error**; a same-post reply → succeeds.
**Follow-ups:** Apply `00005` then `00006` in the Supabase SQL editor and run the matrix above. Still open (separate TODO items): make `post-images` a private bucket; optional friendlier `createComment` parent pre-check; the pre-existing lint errors. Uncommitted at time of writing.

## 2026-07-14 — Performance and redundancy audit documented
**By:** OpenCode (agent)
**Summary:** Audited database query shape, server request flow, RSC payloads, client hydration, and redundant indexes. Confirmed unbounded collection reads, an incomplete community feed, duplicated user/membership reads, stale mention-search timers, avoidable serialized work, over-fetched profile fields, and index follow-ups; added implementation criteria without changing runtime behavior.
**Changed:** `docs/DEVLOG.md`, `docs/TODO.md`, `docs/DATABASE.md`
**Why:** User-requested optimization review, with emphasis on safe RLS-aware improvements rather than cross-user caching.
**Follow-ups:** Ship pagination and its composite indexes together; capture an authenticated production-like benchmark baseline after the data-shape fixes.

## 2026-07-14 — Full code review findings documented
**By:** OpenCode (agent)
**Summary:** Audited migrations/RLS, server actions and queries, routes, and components. Confirmed one critical and five high-severity access/privacy defects plus integrity, export, client-state, semantic, and lint issues; recorded remediation acceptance criteria without changing application behavior.
**Changed:** `docs/DEVLOG.md`, `docs/TODO.md`, `docs/SECURITY.md`, `docs/DATABASE.md`
**Why:** User-requested full project review; the browser can directly invoke Supabase APIs, so RLS gaps must be tracked before further feature work.
**Follow-ups:** Create and manually apply a new `00006` migration for the documented RLS fixes after `00005` is applied; run direct PostgREST regression checks and restore a clean lint gate.

## 2026-07-14 — Project docs system established
**By:** Claude (agent)
**Summary:** Added `CLAUDE.md` (agent entry point / working rules) plus the `docs/` set: `DEVLOG.md` (this log), `TODO.md` (backlog), `ARCHITECTURE.md`, `SECURITY.md`, `DATABASE.md`, `DECISIONS.md`, `SETUP.md`. All cross-linked; `CLAUDE.md` routes agents to the right one. Verified no secrets are tracked and all docs use placeholder config only. Flagged `README.md` / `PROJECT_OUTLINE.txt` as partially stale.
**Changed:** `CLAUDE.md`, `docs/*.md`
**Why:** Keep the project organized and give coding agents a consistent, self-documenting workflow.
**Follow-ups:** Reconcile / slim stale `README.md` + `PROJECT_OUTLINE.txt` against the new docs (tracked in TODO).

## 2026-07-14 — Whole-project code review + fixes (migration 00005)
**By:** Claude (agent)
**Summary:** Reviewed the whole project and fixed six findings. New migration `00005_review_fixes.sql`: (F10) gate comment/like INSERT RLS on post visibility; (F11) constrain notification INSERT to real relationships (closes actor/target spoofing residual from F6); (F12) make the signup username trigger collision-tolerant; (F13) make tokened invite links multi-use while targeted invites stay single-use. Code: deduped `getCommunityPosts` through `enrichPosts`, and moved like/comment counts into the DB via PostgREST embedded aggregates (`likes(count), comments(count)`) so `enrichPosts` only queries the caller's own likes.
**Changed:** `supabase/migrations/00005_review_fixes.sql` (**needs manual apply**), `lib/queries/feed.ts`, `lib/queries/posts.ts`, `lib/queries/communities.ts`
**Why:** Close the gaps found in review; reduce feed query cost.
**Follow-ups:** Apply `00005` in the Supabase SQL editor. After applying, smoke-test that (a) like/comment/follow still create notifications under the tighter F11 policy, and (b) a shared invite link works for a second person. Moderator promote path left for later (see TODO). Uncommitted at time of writing.

## 2026-06-03 — Upload + profile + storage RLS fixes
**By:** human (commit `dd9a807`)
**Summary:** Fixed upload format rejection, profile staleness after edits, and tightened storage RLS.
**Changed:** `supabase/migrations/00004_security_hardening.sql`, upload/profile paths.
**Why:** Bugs + storage hardening follow-up.
**Follow-ups:** none recorded.

## 2026-06-01 — Security hardening (migration 00004)
**By:** human (commit `c1cc335`)
**Summary:** Broad RLS hardening: membership-gated reads for community content, removed world-readable invite tokens (moved to `SECURITY DEFINER` RPCs `get_invite_by_token` / `accept_invite`), dropped redundant `profiles.email`, notification actor check, storage path + MIME enforcement, locked function `search_path`, DB-level content length limits.
**Changed:** `supabase/migrations/00004_security_hardening.sql`, invite server actions.
**Why:** Addressed an audit (findings F1–F9).
**Follow-ups:** F6 left a residual (notification `user_id` spoofable) — later closed by F11 in `00005`.

## 2026-06-01 — "Editorial Ink" UI overhaul + mentions/replies + legal (migrations 00002, 00003)
**By:** human (commit `8467841`)
**Summary:** Redesigned the UI to the "Editorial Ink" identity (warm paper, ink, vermillion accent, Fraunces + Hanken Grotesk). Added @mentions and nested comment replies (`00002`), account deletion + data export for GDPR/CCPA (`00003`), and legal pages (`/legal/*`) with signup consent + age gate.
**Changed:** `app/globals.css`, `app/layout.tsx`, many components, `supabase/migrations/00002_mentions_and_replies.sql`, `00003_account_deletion.sql`, `app/legal/*`, `lib/legal/config.ts`.
**Why:** Bolder brand direction + compliance for a global (EU+US) audience.
**Follow-ups:** Legal copy is template text — needs counsel review; entity/contact placeholders in `lib/legal/config.ts` to be filled.

## 2026-03-24 — Full app build (migration 00001)
**By:** human (commit `944bb50`)
**Summary:** Built the full MVP: auth, profiles, chronological feed, posts/comments/likes/follows, communities + invite flow, notifications, search — Next.js + Supabase with RLS from the start.
**Changed:** most of `app/`, `components/`, `lib/`, `supabase/migrations/00001_schema.sql`.
**Why:** Recode the prototype into a working platform.
**Follow-ups:** became the base for the redesign + hardening above.

## 2026-03-15 — Initial commit
**By:** human (commit `2b7b5c1`)
**Summary:** Create Next App scaffold.
