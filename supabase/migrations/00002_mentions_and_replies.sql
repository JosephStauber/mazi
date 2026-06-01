-- ============================================================
-- Mazi — Mentions + nested comment replies
-- Apply in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: guarded with IF [NOT] EXISTS.
-- ============================================================

-- 1. Nested comment replies -----------------------------------
alter table public.comments
  add column if not exists parent_id uuid
  references public.comments(id) on delete cascade;

create index if not exists idx_comments_parent
  on public.comments(parent_id);

-- 2. Mention notifications ------------------------------------
-- Extend the allowed notification types to include 'mention'.
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in ('like', 'comment', 'follow', 'community_invite', 'mention'));
