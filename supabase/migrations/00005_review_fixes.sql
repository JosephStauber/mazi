-- ============================================================
-- 00005 — Code-review fixes (F10–F13)
-- Run in the Supabase SQL editor AFTER 00001–00004.
-- Idempotent: safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- F10: Gate comment/like INSERTs on post visibility.
-- The 00004 (F5) read policies hide posts/comments/likes in
-- invite-only communities from non-members, but the write
-- policies only checked author_id/user_id = auth.uid(). Anyone
-- holding a hidden post's UUID (e.g. a member who later left)
-- could still write comments/likes to it — and fire a
-- notification at the author. Mirror the F5 read predicate so a
-- row can only be written against a post the caller can see.
-- ------------------------------------------------------------
drop policy if exists "Users can create comments" on public.comments;
drop policy if exists "Users can comment on visible posts" on public.comments;
create policy "Users can comment on visible posts"
  on public.comments for insert
  to authenticated
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

drop policy if exists "Users can create likes" on public.likes;
drop policy if exists "Users can like visible posts" on public.likes;
create policy "Users can like visible posts"
  on public.likes for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.posts p
      where p.id = likes.post_id
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
-- F11: Close notification target spoofing. 00004 (F6) required
-- actor_id = auth.uid() but left user_id/type/post_id/community_id
-- unconstrained, so any user could fabricate a notification to
-- any victim (fake invite, fake comment, etc.). Require the
-- underlying relationship to actually exist for each type.
-- Recipients still read only their own rows (SELECT policy
-- unchanged). App-side inserts are best-effort, so a rejected
-- row never breaks the parent post/comment/follow/invite.
-- ------------------------------------------------------------
drop policy if exists "Users can create notifications as themselves" on public.notifications;
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
      -- Comment: the actor authored the comment, and the recipient
      -- is the post's author or the parent comment's author.
      or (
        type = 'comment'
        and comment_id is not null
        and exists (
          select 1 from public.comments c
          where c.id = notifications.comment_id and c.author_id = auth.uid()
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
      -- Mention: the recipient's @username appears in the actor's
      -- own post/comment that this notification points at.
      -- (Usernames are [a-zA-Z0-9_] only, so no regex injection.)
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
-- F12: Make the signup trigger tolerant of username collisions.
-- handle_new_user inserts into profiles.username (unique) from an
-- AFTER INSERT trigger on auth.users; a collision (a race, or two
-- emails whose local-part matches) rolled the whole signup back
-- with an opaque "Database error saving new user". De-duplicate
-- with a random suffix, mirroring ensureProfileForAuthUser().
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
begin
  base := coalesce(
    nullif(new.raw_user_meta_data->>'username', ''),
    split_part(new.email, '@', 1)
  );
  base := regexp_replace(base, '[^a-zA-Z0-9_]', '_', 'g');
  base := regexp_replace(base, '_+', '_', 'g');
  base := regexp_replace(base, '(^_|_$)', '', 'g');
  if base is null or char_length(base) < 3 then
    base := 'u_' || left(replace(gen_random_uuid()::text, '-', ''), 12);
  end if;
  base := left(base, 30);

  candidate := base;
  for i in 1..10 loop
    begin
      insert into public.profiles (id, username) values (new.id, candidate);
      return new;
    exception when unique_violation then
      candidate :=
        left(base, 23) || '_' || left(replace(gen_random_uuid()::text, '-', ''), 6);
    end;
  end loop;

  -- Extremely unlikely fallback: a fully random handle.
  insert into public.profiles (id, username)
  values (new.id, 'u_' || left(replace(gen_random_uuid()::text, '-', ''), 20));
  return new;
end;
$$;

-- ------------------------------------------------------------
-- F13: Make shareable invite links multi-use. A tokened invite
-- (invitee_id IS NULL) is a reusable link: accepting it just adds
-- membership without consuming the row, so a link copied to many
-- people works for all of them. Targeted invites (invitee_id set)
-- stay single-use and flip to 'accepted'. Previously the first
-- accept flipped the shared row to 'accepted', after which
-- get_invite_by_token (pending-only) returned nothing for everyone
-- else.
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
    -- Targeted invite: only the named invitee, single-use.
    if v_invite.invitee_id <> auth.uid() then
      raise exception 'This invite is for someone else';
    end if;
    if v_invite.status not in ('pending', 'accepted') then
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
