-- ============================================================
-- 00012 — Reservation / access-tier security hardening
-- Run in the Supabase SQL editor AFTER 00011. Idempotent.
--
-- Closes the review findings on the pre-launch tier system. The theme: a
-- reserved account holds a real JWT + the anon key and can hit PostgREST /
-- Auth / Storage directly, so every part of "reserved = outside the app" must
-- hold at the DB, not the UI. Tier gates on the complex existing policies are
-- added as RESTRICTIVE policies (AND-ed with the originals) to avoid error-
-- prone reproduction.
-- ============================================================

-- ------------------------------------------------------------
-- #1 — profiles: make privilege columns client-non-writable.
-- The owner UPDATE/INSERT policies allowed ANY column, so a reserved JWT could
-- PATCH access_level -> 'full'. Postgres column privileges are independent of
-- RLS: revoke table-level write and grant only the editable columns.
-- ------------------------------------------------------------
revoke insert, update on public.profiles from authenticated;
grant insert (id, username, bio, avatar_url) on public.profiles to authenticated;
grant update (username, bio, avatar_url) on public.profiles to authenticated;

-- ------------------------------------------------------------
-- #2 — signup mode is authoritative in the DB, not in client metadata or the
-- public env flag. The trigger derives access_level from app_config, so a
-- direct /auth/v1/signup (no funnel) during reservation mode still lands
-- 'reserved', and post-launch /reserve calls land 'full' (not stuck).
-- ------------------------------------------------------------
create table if not exists public.app_config (
  id boolean primary key default true,
  signup_mode text not null default 'reservation'
    check (signup_mode in ('reservation', 'open')),
  updated_at timestamptz not null default now(),
  constraint app_config_singleton check (id)
);
insert into public.app_config (id) values (true) on conflict (id) do nothing;
alter table public.app_config enable row level security;
-- No policies: only SECURITY DEFINER functions (the trigger) read it.

-- ------------------------------------------------------------
-- #3 — reserved accounts must not READ the app either. Restrictive SELECT
-- policies AND `has_full_access()` onto the existing permissive reads, with an
-- own-row escape so a reserved user can still read their own profile (their
-- reservation is already owner-only). Full users are unaffected.
-- ------------------------------------------------------------
drop policy if exists "Tier gate: profiles read" on public.profiles;
create policy "Tier gate: profiles read" on public.profiles
  as restrictive for select to authenticated
  using (public.has_full_access() or id = auth.uid());

drop policy if exists "Tier gate: posts read" on public.posts;
create policy "Tier gate: posts read" on public.posts
  as restrictive for select to authenticated
  using (public.has_full_access() or author_id = auth.uid());

drop policy if exists "Tier gate: comments read" on public.comments;
create policy "Tier gate: comments read" on public.comments
  as restrictive for select to authenticated
  using (public.has_full_access() or author_id = auth.uid());

drop policy if exists "Tier gate: likes read" on public.likes;
create policy "Tier gate: likes read" on public.likes
  as restrictive for select to authenticated
  using (public.has_full_access() or user_id = auth.uid());

drop policy if exists "Tier gate: follows read" on public.follows;
create policy "Tier gate: follows read" on public.follows
  as restrictive for select to authenticated
  using (public.has_full_access());

drop policy if exists "Tier gate: communities read" on public.communities;
create policy "Tier gate: communities read" on public.communities
  as restrictive for select to authenticated
  using (public.has_full_access());

drop policy if exists "Tier gate: community_members read" on public.community_members;
create policy "Tier gate: community_members read" on public.community_members
  as restrictive for select to authenticated
  using (public.has_full_access());

-- ------------------------------------------------------------
-- #10 — tier-gate the remaining WRITE surfaces (update/delete + notification
-- and invite creation) so a downgraded ex-full account can't keep acting.
-- Restrictive, so they AND with the existing owner/mod policies. Deliberate
-- exceptions (kept open): profile edit, avatar, notification read-state,
-- invite decline, leaving a community, account deletion.
-- ------------------------------------------------------------
drop policy if exists "Tier gate: posts write" on public.posts;
create policy "Tier gate: posts write" on public.posts
  as restrictive for update to authenticated
  using (public.has_full_access()) with check (public.has_full_access());
drop policy if exists "Tier gate: posts delete" on public.posts;
create policy "Tier gate: posts delete" on public.posts
  as restrictive for delete to authenticated using (public.has_full_access());

drop policy if exists "Tier gate: comments write" on public.comments;
create policy "Tier gate: comments write" on public.comments
  as restrictive for update to authenticated
  using (public.has_full_access()) with check (public.has_full_access());
drop policy if exists "Tier gate: comments delete" on public.comments;
create policy "Tier gate: comments delete" on public.comments
  as restrictive for delete to authenticated using (public.has_full_access());

drop policy if exists "Tier gate: likes delete" on public.likes;
create policy "Tier gate: likes delete" on public.likes
  as restrictive for delete to authenticated using (public.has_full_access());

drop policy if exists "Tier gate: follows delete" on public.follows;
create policy "Tier gate: follows delete" on public.follows
  as restrictive for delete to authenticated using (public.has_full_access());

drop policy if exists "Tier gate: communities write" on public.communities;
create policy "Tier gate: communities write" on public.communities
  as restrictive for update to authenticated
  using (public.has_full_access()) with check (public.has_full_access());
drop policy if exists "Tier gate: communities delete" on public.communities;
create policy "Tier gate: communities delete" on public.communities
  as restrictive for delete to authenticated using (public.has_full_access());

drop policy if exists "Tier gate: invites create" on public.community_invites;
create policy "Tier gate: invites create" on public.community_invites
  as restrictive for insert to authenticated with check (public.has_full_access());

drop policy if exists "Tier gate: notifications create" on public.notifications;
create policy "Tier gate: notifications create" on public.notifications
  as restrictive for insert to authenticated with check (public.has_full_access());

-- ------------------------------------------------------------
-- #5 — post-image uploads. Storage INSERT is direct-callable, so a reserved
-- user could stash public files. Gate only the post-images bucket (avatars
-- stay open for profile customization).
-- ------------------------------------------------------------
drop policy if exists "Tier gate: post-image upload" on storage.objects;
create policy "Tier gate: post-image upload" on storage.objects
  as restrictive for insert to authenticated
  with check (bucket_id <> 'post-images' or public.has_full_access());

-- ------------------------------------------------------------
-- #9 — reservations are trigger-written only. Drop the client INSERT policy so
-- a full user can't forge a reservation row / inflate someone's referrals.
-- ------------------------------------------------------------
drop policy if exists "Owners can create own reservation" on public.reservations;

-- #8 — case-insensitive username uniqueness (availability check is already
-- case-insensitive; the constraint was case-sensitive, allowing Alice/alice).
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

-- #11 — index the dashboard list's sort/scan.
create index if not exists reservations_created_at_idx
  on public.reservations (created_at desc);

-- ------------------------------------------------------------
-- #4 — rate limiter: server-fixed limits (caller no longer picks max/window/
-- bucket), hashed key (no raw IP retained), global expiry cleanup. Still
-- best-effort defense-in-depth — Supabase Auth's own limits + a CAPTCHA are
-- the real anti-abuse control for the directly-callable Auth endpoint.
-- ------------------------------------------------------------
drop function if exists public.rate_limit_hit(text, text, int, int);
create or replace function public.rate_limit_hit(p_action text, p_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
  v_window int;
  v_key text;
  v_count int;
begin
  case p_action
    when 'reserve' then v_max := 5; v_window := 3600;
    when 'username_check' then v_max := 90; v_window := 300;
    else return true; -- unknown action: never block
  end case;

  v_key := md5(coalesce(nullif(p_key, ''), 'unknown'));

  -- Bounded global cleanup keeps the table from growing without limit.
  delete from public.rate_limits where created_at < now() - interval '1 day';

  select count(*) into v_count
    from public.rate_limits
    where bucket = p_action and key = v_key
      and created_at >= now() - make_interval(secs => v_window);

  if v_count >= v_max then
    return false;
  end if;

  insert into public.rate_limits (bucket, key) values (p_action, v_key);
  return true;
exception
  when others then
    return true; -- fail open
end;
$$;
grant execute on function public.rate_limit_hit(text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- #9 — user-facing referral count reflects only CONFIRMED referrals
-- (reward-eligible). The dashboard still shows raw referred counts to admins.
-- ------------------------------------------------------------
create or replace function public.get_referral_count()
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::int
  from public.reservations r
  join auth.users u on u.id = r.profile_id
  where r.referred_by = (
      select referral_code from public.reservations where profile_id = auth.uid()
    )
    and u.email_confirmed_at is not null;
$$;
grant execute on function public.get_referral_count() to authenticated;
revoke execute on function public.get_referral_count() from public, anon;

-- ------------------------------------------------------------
-- #17 — accept/decline invite races: lock the invite row and make the status
-- transition conditional so concurrent calls can't leave inconsistent state.
-- Bodies reproduced from the live 00010/00006 versions + row lock.
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

  select * into v_invite from public.community_invites
    where id = p_invite_id for update;
  if not found then
    raise exception 'Invite not found or already used';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'Invite has expired';
  end if;

  if v_invite.invitee_id is null then
    if v_invite.status <> 'pending' then
      raise exception 'Invite not found or already used';
    end if;
  else
    if v_invite.invitee_id <> auth.uid() then
      raise exception 'This invite is for someone else';
    end if;
    update public.community_invites set status = 'accepted'
      where id = p_invite_id and status = 'pending';
    if not found then
      raise exception 'Invite not found or already used';
    end if;
  end if;

  insert into public.community_members (community_id, user_id, role)
    values (v_invite.community_id, auth.uid(), 'member')
    on conflict (community_id, user_id) do nothing;

  return v_invite.community_id;
end;
$$;

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

  select * into v_invite from public.community_invites
    where id = p_invite_id for update;
  if not found then
    raise exception 'Invite not found';
  end if;
  if v_invite.invitee_id is null or v_invite.invitee_id <> auth.uid() then
    raise exception 'This invite is not yours to decline';
  end if;

  update public.community_invites set status = 'declined'
    where id = p_invite_id and status = 'pending';
  if not found then
    raise exception 'Invite is no longer pending';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- #6 + #16 — admin stats: filter NULL reasons defensively, zero-fill the
-- minute buckets so all five categories always render.
-- ------------------------------------------------------------
create or replace function public.admin_reservation_stats()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  select jsonb_build_object(
    'total', (select count(*) from public.reservations),
    'today', (select count(*) from public.reservations
              where created_at >= date_trunc('day', now())),
    'last7', (select count(*) from public.reservations
              where created_at >= now() - interval '7 days'),
    'last30', (select count(*) from public.reservations
               where created_at >= now() - interval '30 days'),
    'confirmed', (select count(*) from public.reservations r
                  join auth.users u on u.id = r.profile_id
                  where u.email_confirmed_at is not null),
    'customized', (select count(*) from public.reservations r
                   join public.profiles p on p.id = r.profile_id
                   where p.bio is not null or p.avatar_url is not null),
    'referred', (select count(*) from public.reservations
                 where referred_by is not null),
    'avg_minutes', (select round(avg(daily_social_minutes))
                    from public.reservations where daily_social_minutes is not null),
    'median_minutes', (select percentile_cont(0.5) within group (order by daily_social_minutes)
                       from public.reservations where daily_social_minutes is not null),
    'sum_minutes', (select coalesce(sum(daily_social_minutes), 0)
                    from public.reservations where daily_social_minutes is not null),
    'reasons', (
      select coalesce(jsonb_object_agg(reason, c), '{}'::jsonb)
      from (
        select reason, count(*) c
        from public.reservations, lateral unnest(reasons) as reason
        where reason is not null
        group by reason
      ) r
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'count', coalesce(c, 0)) order by d), '[]'::jsonb)
      from generate_series((current_date - 29)::timestamptz, current_date::timestamptz, interval '1 day') g(d)
      left join (
        select date_trunc('day', created_at)::date dd, count(*) c
        from public.reservations group by 1
      ) x on x.dd = g.d::date
    ),
    'minute_buckets', (
      select jsonb_agg(jsonb_build_object('label', label, 'count', coalesce(c, 0)) order by ord)
      from (values (1, '<1h', 0, 59), (2, '1-2h', 60, 119), (3, '2-3h', 120, 179),
                   (4, '3-4h', 180, 239), (5, '4h+', 240, 100000)) as b(ord, label, lo, hi)
      left join lateral (
        select count(*) c from public.reservations
        where daily_social_minutes between b.lo and b.hi
      ) cc on true
    ),
    'top_referrers', (
      select coalesce(jsonb_agg(jsonb_build_object('username', username, 'count', c) order by c desc), '[]'::jsonb)
      from (
        select p.username, count(*) c
        from public.reservations child
        join public.reservations parent on parent.referral_code = child.referred_by
        join public.profiles p on p.id = parent.profile_id
        where child.referred_by is not null
        group by p.username
        order by c desc
        limit 10
      ) t
    )
  ) into result;

  return result;
end;
$$;
grant execute on function public.admin_reservation_stats() to authenticated;
revoke execute on function public.admin_reservation_stats() from public, anon;

-- ------------------------------------------------------------
-- #2 + #6 + #9 + #12 — handle_new_user: mode-authoritative access tier,
-- sanitized reasons (canonical set, no nulls, deduped), clamped minutes,
-- no self-referral. Reproduces the username de-dup.
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
  v_mode text;
  v_access text;
  v_ref_code text := nullif(new.raw_user_meta_data->>'referral_code', '');
  v_referred_by text := nullif(new.raw_user_meta_data->>'referred_by', '');
  v_daily int;
  v_reasons text[] := '{}';
  c_reasons text[] := array['privacy','data_selling','ads','addictive',
                            'algorithm','short_form','outrage','comparison'];
begin
  -- Access tier comes from server config, never from client metadata.
  select signup_mode into v_mode from public.app_config where id = true;
  v_access := case when coalesce(v_mode, 'reservation') = 'reservation'
                   then 'reserved' else 'full' end;

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

  -- Sanitize reservation metadata (only used to build the reservation row).
  begin
    v_daily := (new.raw_user_meta_data->>'daily_social_minutes')::int;
  exception when others then
    v_daily := null;
  end;
  if v_daily is not null then
    v_daily := greatest(0, least(1440, v_daily));
  end if;

  v_reasons := array(
    select distinct e
    from jsonb_array_elements_text(
      coalesce(new.raw_user_meta_data->'reasons', '[]'::jsonb)
    ) as t(e)
    where e is not null and e = any (c_reasons)
  );

  if v_referred_by is not null
     and (v_referred_by = v_ref_code
          or not exists (select 1 from public.reservations where referral_code = v_referred_by)) then
    v_referred_by := null;
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
    insert into public.profiles (id, username, access_level)
      values (new.id, 'u_' || left(replace(gen_random_uuid()::text, '-', ''), 20), v_access);
  end if;

  if v_ref_code is not null then
    insert into public.reservations
      (profile_id, reasons, daily_social_minutes, referral_code, referred_by)
      values (new.id, v_reasons, v_daily, v_ref_code, v_referred_by);
  end if;

  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
