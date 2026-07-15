-- ============================================================
-- 00008 — Username format CHECK + invite-RPC grant re-assertion
-- Run in the Supabase SQL editor AFTER 00001–00007.
-- Idempotent: safe to re-run.
--
-- Two pre-merge review follow-ups, both at the DB layer (the browser
-- holds the anon key + a user JWT and calls PostgREST directly, so
-- neither can be enforced by a server action):
--
--   1. profiles.username had no DB constraint. The [a-zA-Z0-9_]{3,30}
--      rule lived only in Zod (lib/validators/profile.ts) and the
--      signup trigger's sanitizer, both bypassable by a direct
--      PATCH /rest/v1/profiles on the caller's own row. The
--      notification 'mention' RLS branch (00005/00006) interpolates
--      pr.username into a `~` regex and *asserts* usernames are
--      [a-zA-Z0-9_] only ("so no regex injection") — nothing backed
--      that. Mirror the format limit as a CHECK, matching the project
--      rule "any user-facing format limit also gets a DB CHECK".
--
--   2. 00005/00006 redefined accept_invite(uuid) with CREATE OR REPLACE
--      but did not re-assert its ACL. It works today because REPLACE
--      preserves the grant 00004 set, but the files are not
--      self-contained: were the function ever created fresh by 00005
--      (00004's version absent), EXECUTE would default to PUBLIC
--      (incl. anon). Re-assert the intended ACL idempotently here.
-- ============================================================


-- ------------------------------------------------------------
-- 1. profiles.username — enforce the [a-zA-Z0-9_]{3,30} format.
--
-- Added NOT VALID so a manual apply cannot fail on any pre-existing
-- row (the old JS collision fallback `u_${nanoid(10)}` could contain a
-- '-'; that path is fixed in lib/queries/profiles.ts in the same
-- change). NOT VALID skips only the historical full-table scan — the
-- constraint is fully enforced on every future INSERT/UPDATE, which is
-- the direct-PATCH vector we are closing. Existing data can be
-- back-validated later with `ALTER TABLE ... VALIDATE CONSTRAINT`.
-- ------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_username_format;
alter table public.profiles
  add constraint profiles_username_format
  check (username ~ '^[a-zA-Z0-9_]{3,30}$')
  not valid;


-- ------------------------------------------------------------
-- 2. accept_invite(uuid) — re-assert the intended execute privilege.
--    Declarative and idempotent; matches 00004's original grant and
--    the pattern decline_invite already follows in 00006.
-- ------------------------------------------------------------
revoke all on function public.accept_invite(uuid) from public, anon;
grant execute on function public.accept_invite(uuid) to authenticated;
