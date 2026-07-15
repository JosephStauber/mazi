-- ============================================================
-- 00006 — RLS / integrity fixes (July 14 audit follow-up)
-- Run in the Supabase SQL Editor AFTER 00001–00005.
-- Idempotent: safe to re-run.
--
-- The browser holds the anon key + a user JWT and can call the
-- PostgREST/Storage APIs directly, so every fix below lives at the
-- RLS / trigger / SECURITY DEFINER layer — never trust the server
-- actions for access control.
--
-- Closes seven confirmed defects:
--   A. Invitee could PATCH community_invites.community_id (or any
--      other column) then accept_invite() into a community they
--      were never invited to.
--   B. posts INSERT let any authenticated user post into a
--      community they are not a member of (incl. invite-only).
--   C. avatar Storage UPDATE skipped the path/extension/MIME checks
--      enforced on INSERT (SVG/HTML stored-XSS re-entry).
--   D. notification type='comment' did not prove comment_id belongs
--      to post_id (cross-post comment-notification spoofing).
--   E. A targeted invite already 'accepted' could be accepted again,
--      letting a removed member rejoin.
--   F. posts/comments had edit actions but no owner UPDATE policy
--      (edits silently affected zero rows under default-deny RLS).
--   G. comments.parent_id could point at a comment on another post,
--      or at itself, corrupting reply trees and notification targets.
-- ============================================================


-- ------------------------------------------------------------
-- A. community_invites — make invite metadata immutable to clients.
--
-- 00004 left an UPDATE policy with only a USING clause and no
-- WITH CHECK, so a named invitee could rewrite ANY column
-- (community_id, inviter_id, invitee_id, token, expires_at, status)
-- and then call accept_invite() to join a different, invite-only
-- community. RLS cannot compare OLD vs NEW columns, so we remove
-- direct client UPDATEs entirely and expose the one legitimate
-- transition — a targeted invitee declining a pending invite —
-- through a narrow SECURITY DEFINER RPC. Acceptance already runs in
-- accept_invite(); no client ever needs to write this table directly.
-- ------------------------------------------------------------
drop policy if exists "Invitee can update invite status" on public.community_invites;
drop policy if exists "Invitee can decline invite" on public.community_invites;

create or replace function public.decline_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.community_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite
  from public.community_invites
  where id = p_invite_id;
  if not found then
    raise exception 'Invite not found';
  end if;

  -- Only the named invitee of a targeted invite may decline it.
  -- Shareable token links (invitee_id IS NULL) are not per-user
  -- declinable; a recipient simply ignores the link.
  if v_invite.invitee_id is null or v_invite.invitee_id <> auth.uid() then
    raise exception 'This invite is not yours to decline';
  end if;

  -- Only a still-pending invite can be declined.
  if v_invite.status <> 'pending' then
    raise exception 'Invite is no longer pending';
  end if;

  update public.community_invites
    set status = 'declined'
    where id = p_invite_id;
end;
$$;
revoke all on function public.decline_invite(uuid) from public, anon;
grant execute on function public.decline_invite(uuid) to authenticated;


-- ------------------------------------------------------------
-- B. posts INSERT — require membership for community posts.
--
-- 00001 only checked author_id = auth.uid(), so any authenticated
-- user could insert a post into any community_id, including an
-- invite-only one they had never joined. Require membership when
-- community_id is non-null; personal (community_id IS NULL) posts
-- are unaffected.
-- ------------------------------------------------------------
drop policy if exists "Users can create posts" on public.posts;
create policy "Users can create posts"
  on public.posts for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and (
      community_id is null
      or exists (
        select 1 from public.community_members m
        where m.community_id = posts.community_id
          and m.user_id = auth.uid()
      )
    )
  );


-- ------------------------------------------------------------
-- F. posts UPDATE — owner-only edit policy (was missing entirely).
--
-- editPost() issues an UPDATE, but no UPDATE policy existed, so
-- default-deny silently changed zero rows. Author-only, and the
-- WITH CHECK mirrors the INSERT membership rule so an edit can't
-- smuggle a post into a community the author isn't a member of.
-- (Content-only edits by a current member are unaffected.)
-- ------------------------------------------------------------
drop policy if exists "Authors can update own posts" on public.posts;
create policy "Authors can update own posts"
  on public.posts for update
  to authenticated
  using (auth.uid() = author_id)
  with check (
    auth.uid() = author_id
    and (
      community_id is null
      or exists (
        select 1 from public.community_members m
        where m.community_id = posts.community_id
          and m.user_id = auth.uid()
      )
    )
  );


-- ------------------------------------------------------------
-- F. comments UPDATE — owner-only edit policy (was missing entirely).
--
-- editComment() issues an UPDATE with no matching policy. Author-only,
-- and the WITH CHECK mirrors the 00005 (F10) insert-visibility
-- predicate so an edit can't relocate a comment onto a post the
-- caller cannot see (the UPDATE equivalent of the F10 write-through).
-- ------------------------------------------------------------
drop policy if exists "Authors can update own comments" on public.comments;
create policy "Authors can update own comments"
  on public.comments for update
  to authenticated
  using (auth.uid() = author_id)
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.posts p
      where p.id = comments.post_id
        and (
          p.author_id = auth.uid()
          or p.community_id is null
          or exists (
            select 1 from public.communities c
            where c.id = p.community_id
              and (
                c.privacy_type = 'public'
                or exists (
                  select 1 from public.community_members m
                  where m.community_id = c.id and m.user_id = auth.uid()
                )
              )
          )
        )
    )
  );


-- ------------------------------------------------------------
-- G. comments.parent_id integrity — same post, never self.
--
-- A reply's parent_id could reference a comment on a DIFFERENT post
-- (or the row itself, since self-referential FKs permit it), which
-- corrupts reply threads and lets the F11 parent-author notification
-- branch target an unrelated user. Enforce at the DB with a
-- trigger; runs SECURITY DEFINER so the integrity check does not
-- depend on the caller's row-visibility.
-- ------------------------------------------------------------
create or replace function public.enforce_comment_parent_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_post uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'A comment cannot be its own parent';
  end if;

  select post_id into v_parent_post
  from public.comments
  where id = new.parent_id;

  if v_parent_post is null then
    raise exception 'Parent comment does not exist';
  end if;

  if v_parent_post <> new.post_id then
    raise exception 'Parent comment belongs to a different post';
  end if;

  return new;
end;
$$;

drop trigger if exists comments_parent_integrity on public.comments;
create trigger comments_parent_integrity
  before insert or update on public.comments
  for each row execute procedure public.enforce_comment_parent_integrity();


-- ------------------------------------------------------------
-- D. notifications INSERT — bind a comment notification to its post.
--
-- 00005 (F11) required actor_id = auth.uid() and a real relationship
-- per type, but the 'comment' branch only checked that the actor
-- authored comment_id and that the recipient owned post_id (or the
-- parent comment) — it never proved comment_id actually lives on
-- post_id. So an actor could comment on their OWN post, then fire a
-- 'comment' notification at any other user whose post they reference
-- via post_id. Re-create the whole policy, tightening only the
-- comment branch (comment_id.post_id must equal post_id); every other
-- branch is reproduced verbatim from F11.
-- ------------------------------------------------------------
drop policy if exists "Users can create legitimate notifications" on public.notifications;
create policy "Users can create legitimate notifications"
  on public.notifications for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and (
      -- Like: the actor liked the recipient's post.
      (
        type = 'like'
        and post_id is not null
        and exists (
          select 1 from public.likes l
          join public.posts p on p.id = l.post_id
          where l.post_id = notifications.post_id
            and l.user_id = auth.uid()
            and p.author_id = notifications.user_id
        )
      )
      -- Comment: the actor authored comment_id, that comment lives on
      -- post_id, and the recipient is the post's author OR the parent
      -- comment's author. (Binding comment_id->post_id is the D fix;
      -- the parent trigger (G) keeps the reply on the same post too.)
      or (
        type = 'comment'
        and comment_id is not null
        and post_id is not null
        and exists (
          select 1 from public.comments c
          where c.id = notifications.comment_id
            and c.author_id = auth.uid()
            and c.post_id = notifications.post_id
        )
        and (
          exists (
            select 1 from public.posts p
            where p.id = notifications.post_id
              and p.author_id = notifications.user_id
          )
          or exists (
            select 1 from public.comments c
            join public.comments parent on parent.id = c.parent_id
            where c.id = notifications.comment_id
              and parent.author_id = notifications.user_id
          )
        )
      )
      -- Follow: the actor follows the recipient.
      or (
        type = 'follow'
        and exists (
          select 1 from public.follows f
          where f.follower_id = auth.uid()
            and f.following_id = notifications.user_id
        )
      )
      -- Community invite: the actor invited the recipient.
      or (
        type = 'community_invite'
        and community_id is not null
        and exists (
          select 1 from public.community_invites i
          where i.community_id = notifications.community_id
            and i.inviter_id = auth.uid()
            and i.invitee_id = notifications.user_id
        )
      )
      -- Mention: the recipient's @username appears in the actor's own
      -- post/comment that this notification points at.
      or (
        type = 'mention'
        and exists (
          select 1 from public.profiles pr
          where pr.id = notifications.user_id
            and (
              case
                when notifications.comment_id is not null then exists (
                  select 1 from public.comments c
                  where c.id = notifications.comment_id
                    and c.author_id = auth.uid()
                    and c.content ~ ('(^|[^a-zA-Z0-9_@])@' || pr.username || '($|[^a-zA-Z0-9_])')
                )
                else exists (
                  select 1 from public.posts p
                  where p.id = notifications.post_id
                    and p.author_id = auth.uid()
                    and p.content ~ ('(^|[^a-zA-Z0-9_@])@' || pr.username || '($|[^a-zA-Z0-9_])')
                )
              end
            )
        )
      )
    )
  );


-- ------------------------------------------------------------
-- E. accept_invite — targeted invites are strictly single-use.
--
-- 00005 (F13) accepted a targeted invite from status IN
-- ('pending','accepted'). That let a removed member re-accept the
-- still-'accepted' invite and rejoin an invite-only community. Only
-- allow acceptance from 'pending'. Shareable token links stay
-- reusable (they never flip status), so second-person joins still
-- work. Body is otherwise identical to F13.
-- ------------------------------------------------------------
create or replace function public.accept_invite(p_invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.community_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite from public.community_invites where id = p_invite_id;
  if not found then
    raise exception 'Invite not found or already used';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'Invite has expired';
  end if;

  if v_invite.invitee_id is null then
    -- Shareable link: reusable. Must still be pending (not revoked).
    if v_invite.status <> 'pending' then
      raise exception 'Invite not found or already used';
    end if;
  else
    -- Targeted invite: only the named invitee, single-use, pending only.
    -- (E fix: previously also allowed 'accepted', enabling rejoin.)
    if v_invite.invitee_id <> auth.uid() then
      raise exception 'This invite is for someone else';
    end if;
    if v_invite.status <> 'pending' then
      raise exception 'Invite not found or already used';
    end if;
    update public.community_invites
      set status = 'accepted'
      where id = p_invite_id;
  end if;

  insert into public.community_members (community_id, user_id, role)
    values (v_invite.community_id, auth.uid(), 'member')
    on conflict (community_id, user_id) do nothing;

  return v_invite.community_id;
end;
$$;


-- ------------------------------------------------------------
-- C. avatars Storage UPDATE — repeat INSERT's path/ext/MIME checks.
--
-- Avatar upload uses upsert, so an existing avatar is replaced via
-- UPDATE. 00001's UPDATE policy only had a USING owner check and no
-- WITH CHECK, so the replacement row's name/extension/mimetype were
-- unconstrained — reopening the .svg/.html stored-XSS path that
-- 00004 (F7) closed on INSERT. Add a WITH CHECK mirroring the INSERT
-- policy. (post-images has no UPDATE policy and uploads to random
-- paths, so it has no equivalent bypass.)
-- ------------------------------------------------------------
drop policy if exists "Users can update own avatar" on storage.objects;
create policy "Users can update own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif')
    and (
      metadata->>'mimetype' is null
      or lower(metadata->>'mimetype') in (
        'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'
      )
    )
  );
