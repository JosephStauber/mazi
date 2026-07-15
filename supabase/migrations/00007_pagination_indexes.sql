-- ============================================================
-- 00007 — Composite indexes for keyset pagination
-- Run in the Supabase SQL editor AFTER 00001–00006.
-- Idempotent: safe to re-run (create index if not exists).
--
-- Every list read is now keyset-paginated on (filter_col, created_at)
-- with an id tiebreaker and a bounded LIMIT. Each index below matches
-- one of those (equality/IN on the leading column, then ordered range
-- scan on created_at) so pages are served from the index instead of a
-- filter + sort over the whole table. Sort direction is chosen to match
-- each list's order; the id tiebreaker (rare same-timestamp case) is a
-- cheap in-memory sort within a timestamp and is not indexed.
--
-- These composites supersede the single-column FK/sort indexes from
-- 00001 for these access paths (e.g. idx_posts_author,
-- idx_posts_community, idx_comments_post, idx_follows_*,
-- idx_community_members_community, idx_notifications_user). Dropping the
-- now-redundant ones is deferred until index names + usage are confirmed
-- in production (see docs/TODO.md) — this migration only ADDs.
-- ============================================================

-- Following feed (posts by followed authors) + profile posts:
--   WHERE author_id [= | in (...)] ORDER BY created_at DESC, id DESC
create index if not exists idx_posts_author_created
  on public.posts (author_id, created_at desc);

-- Communities feed + a single community's posts:
--   WHERE community_id [= | in (...)] ORDER BY created_at DESC, id DESC
create index if not exists idx_posts_community_created
  on public.posts (community_id, created_at desc);

-- Post comment roots (oldest first):
--   WHERE post_id = ? AND parent_id IS NULL ORDER BY created_at ASC, id ASC
create index if not exists idx_comments_post_created
  on public.comments (post_id, created_at);

-- comments(author_id): export ("all my comments") + author-scoped reads,
-- and the currently unindexed author_id cascade FK.
create index if not exists idx_comments_author
  on public.comments (author_id);

-- Community members list (oldest first):
--   WHERE community_id = ? ORDER BY created_at ASC, id ASC
create index if not exists idx_community_members_community_created
  on public.community_members (community_id, created_at);

-- Followers list (newest first):
--   WHERE following_id = ? ORDER BY created_at DESC, id DESC
create index if not exists idx_follows_following_created
  on public.follows (following_id, created_at desc);

-- Following list (newest first):
--   WHERE follower_id = ? ORDER BY created_at DESC, id DESC
create index if not exists idx_follows_follower_created
  on public.follows (follower_id, created_at desc);

-- Notifications list (newest first, LIMIT 50):
--   WHERE user_id = ? ORDER BY created_at DESC
create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);
