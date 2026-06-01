-- ============================================================
-- Security hardening — addresses audit findings 1-9.
-- Run in the Supabase SQL editor AFTER 00001-00003.
-- The browser uses the anon key + a user JWT, so these RLS
-- policies (not the server actions) are the real boundary.
-- ============================================================

-- ------------------------------------------------------------
-- F1 + F2: Community membership — stop arbitrary role self-
-- assignment (privilege escalation) and invite-only bypass.
-- Direct client inserts may only: (a) bootstrap creator role on
-- a community you own, or (b) self-join a PUBLIC community as a
-- plain member. Invite-only joins go through accept_invite()
-- (SECURITY DEFINER) below, which bypasses this policy safely.
-- ------------------------------------------------------------
drop policy if exists "Users can join or be added" on public.community_members;

create policy "Users can join public or bootstrap own community"
  on public.community_members for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (
      (
        role = 'creator'
        and exists (
          select 1 from public.communities c
          where c.id = community_id and c.creator_id = auth.uid()
        )
      )
      or (
        role = 'member'
        and exists (
          select 1 from public.communities c
          where c.id = community_id and c.privacy_type = 'public'
        )
      )
    )
  );

-- ------------------------------------------------------------
-- F3: Invite tokens were world-readable ("token is not null").
-- Restrict reads/updates to the inviter and the named invitee.
-- Token link resolution + acceptance move to definer RPCs.
-- ------------------------------------------------------------
drop policy if exists "Inviter, invitee, or token resolver can view invites"
  on public.community_invites;
create policy "Inviter or invitee can view invites"
  on public.community_invites for select
  to authenticated
  using (auth.uid() = inviter_id or auth.uid() = invitee_id);

drop policy if exists "Invitee can update invite status" on public.community_invites;
create policy "Invitee can update invite status"
  on public.community_invites for update
  to authenticated
  using (auth.uid() = invitee_id);

-- Resolve a shareable invite link without exposing the invites table.
create or replace function public.get_invite_by_token(p_token text)
returns table (
  id uuid,
  community_id uuid,
  community_name text,
  community_slug text,
  community_description text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select i.id, c.id, c.name, c.slug, c.description
  from public.community_invites i
  join public.communities c on c.id = i.community_id
  where i.token = p_token
    and i.status = 'pending'
    and (i.expires_at is null or i.expires_at > now());
end;
$$;
revoke all on function public.get_invite_by_token(text) from public, anon;
grant execute on function public.get_invite_by_token(text) to authenticated;

-- Accept an invite (targeted or token link) atomically.
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
  if not found or v_invite.status not in ('pending', 'accepted') then
    raise exception 'Invite not found or already used';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'Invite has expired';
  end if;
  -- Targeted invites may only be accepted by the named invitee.
  if v_invite.invitee_id is not null and v_invite.invitee_id <> auth.uid() then
    raise exception 'This invite is for someone else';
  end if;

  update public.community_invites
    set status = 'accepted', invitee_id = auth.uid()
    where id = p_invite_id;

  insert into public.community_members (community_id, user_id, role)
    values (v_invite.community_id, auth.uid(), 'member')
    on conflict (community_id, user_id) do nothing;

  return v_invite.community_id;
end;
$$;
revoke all on function public.accept_invite(uuid) from public, anon;
grant execute on function public.accept_invite(uuid) to authenticated;

-- ------------------------------------------------------------
-- F4: profiles.email was readable by every authenticated user
-- (column RLS isn't a thing in PG). Email already lives in
-- auth.users, so drop the redundant copy.
-- ------------------------------------------------------------
alter table public.profiles drop column if exists email;

-- ------------------------------------------------------------
-- F5: Posts/comments/likes in invite-only communities were
-- world-readable. Gate community-scoped rows on membership.
-- (Non-community posts and public communities stay visible.)
-- ------------------------------------------------------------
drop policy if exists "Authenticated users can view posts" on public.posts;
create policy "View public or member posts"
  on public.posts for select
  to authenticated
  using (
    community_id is null
    or exists (
      select 1 from public.communities c
      where c.id = posts.community_id
        and (
          c.privacy_type = 'public'
          or exists (
            select 1 from public.community_members m
            where m.community_id = c.id and m.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "Authenticated users can view comments" on public.comments;
create policy "View comments on visible posts"
  on public.comments for select
  to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = comments.post_id
        and (
          p.community_id is null
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

drop policy if exists "Authenticated users can view likes" on public.likes;
create policy "View likes on visible posts"
  on public.likes for select
  to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = likes.post_id
        and (
          p.community_id is null
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
-- F6: Notification actor spoofing — anyone could insert a
-- notification claiming to be from anyone. Require the actor to
-- be the caller. (Residual: user_id can still be any user;
-- eliminate fully by moving inserts to triggers later.)
-- ------------------------------------------------------------
drop policy if exists "System can create notifications" on public.notifications;
create policy "Users can create notifications as themselves"
  on public.notifications for insert
  to authenticated
  with check (actor_id = auth.uid());

-- ------------------------------------------------------------
-- F7: Storage uploads could be written to any path. Require the
-- first path segment to be the uploader's own user id. (MIME
-- validation is enforced in the server actions.)
-- ------------------------------------------------------------
drop policy if exists "Authenticated users can upload avatars" on storage.objects;
create policy "Users can upload to own avatar folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Authenticated users can upload post images" on storage.objects;
create policy "Users can upload to own post-image folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------
-- F8: Lock the search_path of the signup trigger (and drop the
-- now-removed email column from its insert).
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

-- ------------------------------------------------------------
-- F9: Bound content/bio length at the DB level so direct inserts
-- can't store unbounded blobs (server-side Zod is bypassable).
-- ------------------------------------------------------------
alter table public.posts
  drop constraint if exists posts_content_len,
  add constraint posts_content_len check (char_length(content) <= 10000);
alter table public.comments
  drop constraint if exists comments_content_len,
  add constraint comments_content_len check (char_length(content) <= 5000);
alter table public.profiles
  drop constraint if exists profiles_bio_len,
  add constraint profiles_bio_len check (bio is null or char_length(bio) <= 2000);
