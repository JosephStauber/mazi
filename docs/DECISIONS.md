# DECISIONS

Lightweight log of decisions that shape the project — the choice, the reasoning, and what it supersedes. Consult before reversing something; if you change one, add a new entry rather than editing history, and note which it supersedes. `DEVLOG.md` records *what* changed; this records *why we work this way*.

Format: `### D<n> — Title` · **Date** · **Status** (Active / Superseded by D<n>) · **Decision** · **Why** · **Implications**.

---

### D1 — RLS is the security boundary; anon key only
**Date:** 2026-06-01 · **Status:** Active
**Decision:** The app authenticates to Supabase with the **anon key + user JWT** only. No `service_role` key exists in any client-reachable code. Every access rule is enforced by Postgres Row Level Security, not by server actions.
**Why:** The browser can call the Supabase REST API directly, bypassing server actions entirely. Only RLS is a real boundary.
**Implications:** New tables/columns need RLS from day one. Server actions may add UX/validation but must never be the *only* thing standing between a user and data. See [`SECURITY.md`](SECURITY.md).

### D2 — Migrations applied manually via the Supabase SQL editor
**Date:** 2026-03-24 · **Status:** Active
**Decision:** Schema changes are numbered, idempotent `.sql` files in `supabase/migrations/`, run by hand in the dashboard SQL editor in order. No Supabase CLI / local stack.
**Why:** Project setup has no local Supabase; the remote project is the single environment.
**Implications:** Never edit an already-applied migration to change behavior — add a new one. Always tell the user when a migration needs applying. Agents can't self-verify DB changes; rely on the user to apply + spot-check.

### D3 — "Editorial Ink" visual identity
**Date:** 2026-06-01 · **Status:** Active (supersedes the original black-and-white minimalist aesthetic)
**Decision:** Warm paper background, ink text, single vermillion accent, Fraunces + Hanken Grotesk, faint grain. Driven entirely by CSS-variable tokens in `app/globals.css`.
**Why:** The stark B&W look read as generic/"the same"; the user chose to push bolder into a distinctive editorial identity.
**Implications:** Style via tokens, never hard-coded hex. `README.md` / `PROJECT_OUTLINE.txt` still describe B&W/Geist — stale, pending reconciliation.

### D4 — Chronological only; no algorithm, ads, or tracking
**Date:** 2026-03-24 · **Status:** Active
**Decision:** Feeds are strict reverse-chronological. No ranking, suggested content, ads, or third-party analytics/trackers.
**Why:** Core product ethos — privacy-first, non-manipulative.
**Implications:** Don't introduce ranking or trackers without an explicit reversing decision here. Any analytics must be privacy-respecting and deliberate.

### D5 — Reads/writes split; business logic in `lib/`
**Date:** 2026-03-24 · **Status:** Active
**Decision:** `lib/queries/` for reads, `lib/actions/` for writes (server actions), with types/validators alongside — all decoupled from page components.
**Why:** Clean separation + reuse by a future Expo/React Native app (swap only the Supabase client).
**Implications:** Don't mutate from queries or fetch-for-render from actions. Keep `lib/` framework-agnostic where practical.

### D6 — Global compliance superset
**Date:** 2026-06-01 · **Status:** Active
**Decision:** Target the strictest superset of GDPR, ePrivacy, DSA, CCPA/CPRA, and COPPA (EU + US audience). Shipped: `/legal/*` pages, signup consent + 13+ age gate, account deletion (erasure), JSON data export (access/portability), essential-cookie disclosure.
**Why:** Serve a global audience without per-region rework.
**Implications:** Legal copy is **template — needs counsel review**; entity/contact/jurisdiction are placeholders in `lib/legal/config.ts`. DSA notice-and-action (content reporting) still owed — tracked in `TODO.md`.

### D7 — Invite tokens behind `SECURITY DEFINER` RPCs; links multi-use
**Date:** 2026-06-01 (RPCs), 2026-07-14 (multi-use) · **Status:** Active
**Decision:** Invite rows aren't world-readable. Shareable links resolve/accept via `get_invite_by_token` / `accept_invite` RPCs. A tokened link (no `invitee_id`) is **multi-use**; a targeted invite is **single-use** and flips to `accepted`.
**Why:** F3 closed token exposure; F13 fixed shared links being consumed by the first accepter.
**Implications:** Don't reintroduce direct client reads of `community_invites` beyond inviter/invitee. See `DATABASE.md`.

### D8 — Notification inserts are best-effort and relationship-validated
**Date:** 2026-07-14 · **Status:** Active
**Decision:** Notification creation is fire-and-forget (never breaks the parent action) and RLS requires the underlying relationship to actually exist for each type (F11), closing the earlier actor/target spoofing residual (F6).
**Why:** Prevent forged notifications while keeping the write path resilient.
**Implications:** New notification types need a matching RLS branch in `00005` (or a successor migration). Consider moving to DB triggers later.

### D9 — Moderator role kept dormant (for now)
**Date:** 2026-07-14 · **Status:** Active
**Decision:** The `moderator` role stays defined in schema + RLS but has **no assignment path** yet — intentionally deferred, not a bug. A creator-driven promote feature is planned.
**Why:** Reviewed and chosen by the user; avoids half-building role management under time pressure.
**Implications:** Don't "fix" it by removing moderator support. Build-out plan in `TODO.md` → "Community moderator management".

### D10 — Engagement counts computed in the database
**Date:** 2026-07-14 · **Status:** Active
**Decision:** Like/comment counts come from PostgREST embedded aggregates (`likes(count), comments(count)`) in the post selects; `enrichPosts` only fetches the caller's own likes.
**Why:** The prior approach fetched every like/comment row per feed page to count in JS — unbounded on popular posts.
**Implications:** Any query that needs counts must include the embedded aggregates in its `select`.
