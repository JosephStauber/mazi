-- ============================================================
-- 00010 — Username reservations + pre-launch access tiers
-- Run in the Supabase SQL editor AFTER 00001–00009.
-- Idempotent: safe to re-run.
--
-- Adds the pre-launch "reserve your username" funnel's data layer:
--   * profiles.access_level — 'full' (normal) or 'reserved' (pre-launch
--     signup: can edit their own profile, but cannot use the app yet).
--   * reservations — one row per reserved account holding the onboarding
--     survey answers (what bothers them about social media, daily minutes)
--     and the referral graph (each reservation has a code; referred_by
--     links to the code that brought them in).
--   * has_full_access() — the RLS gate. Reserved accounts hold a real JWT
--     and can call PostgREST directly, so the lockout MUST live at RLS, not
--     just in the UI. Every write policy that means "using the app"
--     (post / comment / like / follow / create-or-join community) now also
--     requires full access. Profile edits stay open so reserved users can
--     still customise their profile.
--   * username_available() — anon-callable availability check for the funnel
--     (reserved names are real profiles, so checking profiles covers them).
--   * get_referral_count() — how many people a reservation has referred.
--   * handle_new_user() extended to honour reservation metadata at signup,
--     so the reservation is recorded atomically regardless of whether email
--     confirmation is on (i.e. regardless of session timing).
--
-- Existing accounts default to 'full', so current testers are unaffected.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Access tier on profiles. Default 'full' keeps every existing
--    row (and any normal post-launch signup) working unchanged.
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists access_level text not null default 'full';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_access_level_check'
  ) then
    alter table public.profiles
      add constraint profiles_access_level_check
      check (access_level in ('reserved', 'full'));
  end if;
end$$;

-- ------------------------------------------------------------
-- 2. reservations — survey answers + referral graph, 1:1 with profile.
--    Email is intentionally NOT stored here; it lives only in auth.users
--    (see 00004). No anon access — a reservation row is private to its owner.
-- ------------------------------------------------------------
create table if not exists public.reservations (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  reasons text[] not null default '{}',
  daily_social_minutes int,
  referral_code text unique not null,
  referred_by text references public.reservations(referral_code) on delete set null,
  created_at timestamptz not null default now(),
  constraint reservations_reasons_len check (coalesce(array_length(reasons, 1), 0) <= 12),
  constraint reservations_minutes_range check (
    daily_social_minutes is null
    or (daily_social_minutes >= 0 and daily_social_minutes <= 1440)
  )
);

create index if not exists reservations_referred_by_idx
  on public.reservations (referred_by);

alter table public.reservations enable row level security;

drop policy if exists "Owners can view own reservation" on public.reservations;
create policy "Owners can view own reservation"
  on public.reservations for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "Owners can create own reservation" on public.reservations;
create policy "Owners can create own reservation"
  on public.reservations for insert
  to authenticated
  with check (auth.uid() = profile_id);

-- ------------------------------------------------------------
-- 3. has_full_access() — the tier gate used by the write policies below.
--    SECURITY DEFINER so it reads profiles without recursing through RLS.
--    Missing profile / reserved => false.
-- ------------------------------------------------------------
create or replace function public.has_full_access()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select access_level = 'full' from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.has_full_access() to authenticated;
-- Least privilege: strip the default PUBLIC grant so anon can't call it directly
-- (it's used inside RLS policies + by signed-in users; policy eval is unaffected).
revoke execute on function public.has_full_access() from public, anon;

-- ------------------------------------------------------------
-- 4. Write-gate the app at RLS. Each policy below is reproduced verbatim
--    from its current migration, with `and public.has_full_access()` added.
--    Reserved accounts therefore cannot post / comment / like / follow /
--    create or join communities, even by calling PostgREST directly.
-- ------------------------------------------------------------

-- posts (from 00006)
drop policy if exists "Users can create posts" on public.posts;
create policy "Users can create posts"
  on public.posts for insert
  to authenticated
  with check (
    public.has_full_access()
    and auth.uid() = author_id
    and (
      community_id is null
      or exists (
        select 1 from public.community_members m
        where m.community_id = posts.community_id
          and m.user_id = auth.uid()
      )
    )
  );

-- comments (from 00005)
drop policy if exists "Users can create comments" on public.comments;
drop policy if exists "Users can comment on visible posts" on public.comments;
create policy "Users can comment on visible posts"
  on public.comments for insert
  to authenticated
  with check (
    public.has_full_access()
    and auth.uid() = author_id
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

-- likes (from 00005)
drop policy if exists "Users can create likes" on public.likes;
drop policy if exists "Users can like visible posts" on public.likes;
create policy "Users can like visible posts"
  on public.likes for insert
  to authenticated
  with check (
    public.has_full_access()
    and auth.uid() = user_id
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

-- follows (from 00001)
drop policy if exists "Users can create follows" on public.follows;
create policy "Users can create follows"
  on public.follows for insert
  to authenticated
  with check (public.has_full_access() and auth.uid() = follower_id);

-- create community (from 00001)
drop policy if exists "Users can create communities" on public.communities;
create policy "Users can create communities"
  on public.communities for insert
  to authenticated
  with check (public.has_full_access() and auth.uid() = creator_id);

-- join community — direct insert path (from 00004)
drop policy if exists "Users can join or be added" on public.community_members;
drop policy if exists "Users can join public or bootstrap own community" on public.community_members;
create policy "Users can join public or bootstrap own community"
  on public.community_members for insert
  to authenticated
  with check (
    public.has_full_access()
    and auth.uid() = user_id
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
-- 5. Gate accept_invite() too. It is SECURITY DEFINER and inserts into
--    community_members bypassing the policy above, so the tier check must
--    live inside the function. Reproduced from 00005 with the guard added.
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

  if not public.has_full_access() then
    raise exception 'Reserved accounts cannot join communities before launch';
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
    -- Targeted invite: only the named invitee, single-use. Accept only from
    -- 'pending' (00006/E — a removed member cannot rejoin via a stale invite).
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
-- 6. username_available() — anon-callable availability check for the funnel.
--    Case-insensitive; reserved names are real profiles so this covers them.
-- ------------------------------------------------------------
create or replace function public.username_available(p_username text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(p_username)
  );
$$;

grant execute on function public.username_available(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 7. get_referral_count() — how many reservations the caller has referred.
--    Definer so it can count rows it otherwise couldn't read.
-- ------------------------------------------------------------
create or replace function public.get_referral_count()
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::int
  from public.reservations
  where referred_by = (
    select referral_code from public.reservations where profile_id = auth.uid()
  );
$$;

grant execute on function public.get_referral_count() to authenticated;
revoke execute on function public.get_referral_count() from public, anon;

-- ------------------------------------------------------------
-- 7b. Rate limiting. The reserve funnel is anon-reachable pre-signup, so both
--     the availability check and account creation need a throttle. A DB-backed
--     limiter works across serverless instances (unlike in-memory). The server
--     action passes the client IP as the key. RLS-locked: only the definer
--     function touches the table; anon/authenticated may only call the function.
-- ------------------------------------------------------------
create table if not exists public.rate_limits (
  id bigint generated always as identity primary key,
  bucket text not null,
  key text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limits_lookup_idx
  on public.rate_limits (bucket, key, created_at);

alter table public.rate_limits enable row level security;
-- No policies: clients can never read/write this table directly.

-- Returns true if the hit is allowed (and records it); false if the key has
-- reached p_max hits within the trailing p_window_seconds. Fails OPEN on any
-- internal error so a limiter bug can never block a legitimate signup.
create or replace function public.rate_limit_hit(
  p_bucket text,
  p_key text,
  p_max int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := coalesce(nullif(p_key, ''), 'unknown');
  v_count int;
begin
  -- Opportunistic cleanup of this key's expired hits keeps the table bounded.
  delete from public.rate_limits
    where bucket = p_bucket and key = v_key
      and created_at < now() - make_interval(secs => p_window_seconds);

  select count(*) into v_count
    from public.rate_limits
    where bucket = p_bucket and key = v_key
      and created_at >= now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max then
    return false;
  end if;

  insert into public.rate_limits (bucket, key) values (p_bucket, v_key);
  return true;
exception
  when others then
    return true; -- fail open: never let the limiter itself deny a real user
end;
$$;

grant execute on function public.rate_limit_hit(text, text, int, int) to anon, authenticated;

-- ------------------------------------------------------------
-- 8. handle_new_user() — record reservation metadata at signup.
--    Reproduces the 00005 username de-dup, and when the signup carries
--    reservation metadata: creates the profile as 'reserved' and inserts
--    the reservation row (survey + referral). Runs on the auth.users insert,
--    so it fires whether or not email confirmation is enabled.
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
  v_inserted boolean := false;
  v_reservation boolean :=
    coalesce(new.raw_user_meta_data->>'reservation', '') = 'true';
  v_access text := case when v_reservation then 'reserved' else 'full' end;
  v_ref_code text := nullif(new.raw_user_meta_data->>'referral_code', '');
  v_referred_by text := nullif(new.raw_user_meta_data->>'referred_by', '');
  v_daily int := nullif(new.raw_user_meta_data->>'daily_social_minutes', '')::int;
  v_reasons text[] := '{}';
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

  if v_reservation then
    v_reasons := array(
      select jsonb_array_elements_text(
        coalesce(new.raw_user_meta_data->'reasons', '[]'::jsonb)
      )
    );
    -- Drop a referral code that doesn't resolve so a bad/expired link can
    -- never roll back the whole signup.
    if v_referred_by is not null
       and not exists (
         select 1 from public.reservations where referral_code = v_referred_by
       ) then
      v_referred_by := null;
    end if;
  end if;

  candidate := base;
  for i in 1..10 loop
    begin
      insert into public.profiles (id, username, access_level)
        values (new.id, candidate, v_access);
      v_inserted := true;
      exit;
    exception when unique_violation then
      candidate :=
        left(base, 23) || '_' || left(replace(gen_random_uuid()::text, '-', ''), 6);
    end;
  end loop;

  if not v_inserted then
    -- Extremely unlikely fallback: a fully random handle.
    insert into public.profiles (id, username, access_level)
      values (new.id, 'u_' || left(replace(gen_random_uuid()::text, '-', ''), 20), v_access);
  end if;

  if v_reservation and v_ref_code is not null then
    insert into public.reservations
      (profile_id, reasons, daily_social_minutes, referral_code, referred_by)
      values (new.id, v_reasons, v_daily, v_ref_code, v_referred_by);
  end if;

  return new;
end;
$$;

-- handle_new_user is a trigger function only; it should never be callable as an
-- RPC. Triggers fire regardless of EXECUTE privilege, so revoking is safe.
revoke all on function public.handle_new_user() from public, anon, authenticated;
