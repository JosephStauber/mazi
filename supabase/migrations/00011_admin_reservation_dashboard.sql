-- ============================================================
-- 00011 — Admin reservation dashboard (read-only, admin-gated)
-- Run in the Supabase SQL editor AFTER 00010.
-- Idempotent: safe to re-run.
--
-- The reservation funnel collects survey answers (public-ish) and emails
-- (PII, in auth.users, unreadable by clients). This adds an admin-only way
-- to see aggregate stats + the outreach list WITHOUT exposing any of it to
-- normal users:
--   * admin_users — allowlist; RLS-locked, only definer functions read it.
--   * is_admin() — the gate.
--   * admin_reservation_stats() — one JSON blob of dashboard metrics.
--   * admin_reservation_list()  — the per-signup table incl. emails.
-- All three are SECURITY DEFINER and raise unless the caller is an admin,
-- so even a full (non-admin) user cannot read the list or the emails.
-- Grant seeding of the first admin is done out-of-band (not in this file)
-- so a personal email never lands in the repo.
-- ============================================================

-- 1. Admin allowlist. RLS on, no policies => no client can read/write it;
--    only the SECURITY DEFINER functions below (which run as owner) touch it.
create table if not exists public.admin_users (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- 2. is_admin() — the gate.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where profile_id = auth.uid()
  );
$$;

grant execute on function public.is_admin() to authenticated;
revoke execute on function public.is_admin() from public, anon;

-- 3. admin_reservation_stats() — dashboard metrics as one JSON object.
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
      from (select unnest(reasons) reason, count(*) c
            from public.reservations group by 1) r
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
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'count', cnt) order by ord), '[]'::jsonb)
      from (
        select
          case when daily_social_minutes < 60 then 1
               when daily_social_minutes < 120 then 2
               when daily_social_minutes < 180 then 3
               when daily_social_minutes < 240 then 4
               else 5 end as ord,
          case when daily_social_minutes < 60 then '<1h'
               when daily_social_minutes < 120 then '1-2h'
               when daily_social_minutes < 180 then '2-3h'
               when daily_social_minutes < 240 then '3-4h'
               else '4h+' end as label,
          count(*) cnt
        from public.reservations
        where daily_social_minutes is not null
        group by 1, 2
      ) b
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

-- 4. admin_reservation_list() — the per-signup outreach table (incl. email).
create or replace function public.admin_reservation_list()
returns table (
  username text,
  email text,
  email_confirmed boolean,
  reasons text[],
  daily_social_minutes int,
  referral_code text,
  referred_by text,
  referral_count bigint,
  bio_set boolean,
  avatar_set boolean,
  created_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  return query
    select
      p.username,
      u.email::text,
      (u.email_confirmed_at is not null),
      r.reasons,
      r.daily_social_minutes,
      r.referral_code,
      r.referred_by,
      (select count(*) from public.reservations x where x.referred_by = r.referral_code),
      (p.bio is not null),
      (p.avatar_url is not null),
      r.created_at
    from public.reservations r
    join public.profiles p on p.id = r.profile_id
    join auth.users u on u.id = r.profile_id
    order by r.created_at desc
    limit 2000;
end;
$$;

grant execute on function public.admin_reservation_list() to authenticated;
revoke execute on function public.admin_reservation_list() from public, anon;
