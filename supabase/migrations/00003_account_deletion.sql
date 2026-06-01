-- Right to erasure (GDPR Art. 17 / CCPA): let a signed-in user delete
-- their own account. Supabase clients cannot delete auth.users directly,
-- so we expose a SECURITY DEFINER function scoped to the caller's own id.
-- Deleting the auth user cascades to public.profiles (on delete cascade),
-- which in turn cascades to posts, comments, likes, follows, memberships,
-- and notifications.

create or replace function public.delete_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_user() from public, anon;
grant execute on function public.delete_user() to authenticated;
