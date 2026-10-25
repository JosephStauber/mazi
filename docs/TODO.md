# TODO — Backlog

Future work, deferred items, and known gaps. **Check here before proposing new work** — it may already be tracked or deliberately deferred. When you finish something, check it off and log it in [`DEVLOG.md`](DEVLOG.md). When you discover or defer something, add it here with enough context to act on later.

Priority buckets: **Now** (do next) · **Next** (soon) · **Later** (someday) · **Housekeeping**. Format: `- [ ] Title — context / acceptance notes`.

> 2026-10-24: Mazi moved from Supabase to Convex + Better Auth + Resend (DEVLOG, DECISIONS D11–D14). Supabase-era items that no longer apply (SQL migrations, RLS policies, SMTP, storage buckets, index cleanup) were removed; their history is in DEVLOG.

---

## Now

- [ ] **Create your own Convex project and deployment.** Development so far ran on a local *anonymous* Convex backend. Run `npx convex dev`, log in, create the project — it rewrites `CONVEX_DEPLOYMENT` / `NEXT_PUBLIC_CONVEX_URL` in `.env.local`. Then set the deployment env vars from `docs/SETUP.md` (`SITE_URL`, `BETTER_AUTH_SECRET`). Do the same for production (`npx convex deploy`) with production values.
- [ ] **Configure Resend.** Verify a sending domain in Resend; set `RESEND_API_KEY` and `RESEND_FROM` on each Convex deployment. Until then, confirmation/reset links only appear in the Convex logs (fine for dev, unusable for real users).
- [ ] **Google / Apple sign-in (when ready).** Create the OAuth apps, set `GOOGLE_CLIENT_ID/SECRET` and/or `APPLE_CLIENT_ID/SECRET` (+ `APPLE_APP_BUNDLE_IDENTIFIER`) on the deployment. Redirect URIs: `<SITE_URL>/api/auth/callback/{google,apple}`. The buttons appear automatically. Untested end-to-end so far (no credentials).
- [ ] **Seed the first admin.** `npx convex run admin:grant '{"username":"<your handle>"}'` (add `--prod` for production) after you have an account. Privilege grant — do it deliberately.
- [ ] **Smoke-test what the migration couldn't exercise:** image upload on a post + avatar (incl. an invite-only community image loading for a member and 404ing for a non-member), passkey add + sign-in on a real device, password reset email, data export download, invite by username + invite link + decline, community moderator delete, the communities feed filter. Verified locally on 2026-10-24: reserve signup → email confirm → `/welcome`, reserved user locked out of `/home`, open mode + promotion, post, like, comment, create community, admin dashboard, account deletion erasing every table.
- [ ] **(Recommended) Add a captcha to signup/reserve.** Better Auth's IP rate limit (10 sign-ups/IP/hour) is the only anti-abuse control. Better Auth has a captcha plugin (Cloudflare Turnstile / reCAPTCHA / hCaptcha).
- [ ] **Replace placeholder pricing.** `PRICING` in `lib/reserve/config.ts`.
- [ ] **Launch-time: flip mode + grant access + reconcile rewards.** `npx convex run --prod admin:setSignupMode '{"mode":"open","promoteReserved":true}'` (repeat until all reserved accounts are promoted), set `NEXT_PUBLIC_LAUNCH_MODE=open` + redeploy, then turn confirmed referrals into the promised free weeks once billing exists. Checklist in `ONBOARDING.md`.

## Next

- [ ] **Batch large deletions.** Account and community deletion run in one Convex transaction (`convex/lib/accounts.ts`, `cascade.ts`). Fine now; a very large account/community could exceed transaction limits. Move to a scheduled, batched deletion (or the `@convex-dev/workflow` component) before that's plausible.
- [ ] **Clean up orphaned uploads.** A file uploaded but never attached (abandoned composer, failed claim) stays in Convex storage. Add a cron that deletes `_storage` files older than a day that no profile/post references.
- [ ] **Rate-limit app writes** (posts, comments, follows, invites) — e.g. `@convex-dev/rate-limiter`. Auth endpoints are limited; app mutations aren't.
- [ ] **Community moderator management (make the `moderator` role usable).** `moderator` exists in the schema and access rules (post/comment delete, `canModerate` UI) but **nothing can assign it** — intentional (D9). To ship: a creator-only `communities:setMemberRole` mutation (member ↔ moderator, never creator), promote/demote/remove controls in `components/community/community-tabs.tsx`, optionally notify the promoted user. Revisit whether mods can remove other mods.
- [ ] **Invite link expiry + revocation.** `communityInvites.expiresAt` exists and is honoured but never set. Let creators pick an expiry and revoke links.
- [ ] **Block / mute users.** Needs a `blocks` table, filtering in feeds/search/notifications (in the Convex queries), and UI. Privacy-relevant — design carefully.
- [ ] **Content reporting flow (DSA notice-and-action).** Report UI on posts/comments, a `reports` table, reviewer tooling.
- [ ] **Following feed cap.** `feed:following` merges at most 2000 followed authors' streams. Fine for small communities; revisit (fan-out-on-write timeline table) if follow counts grow large.

## Later

- [ ] **Expo / React Native app** calling the same Convex functions (Convex React client + Better Auth Expo client).
- [ ] **Profile privacy settings** (Settings "Privacy" toggles are device-local placeholders).
- [ ] **Direct messages** (optional, post-MVP).
- [ ] **Email notifications** (optional; Resend is already wired).
- [ ] **Community rules / guidelines display** on the community page.
- [ ] **Substring search.** Search uses Convex full-text (word + last-term prefix) and a handle-prefix index; `%term%` matching from the Supabase version isn't replicated.

## Housekeeping

- [ ] **Reconcile stale docs.** `README.md` and `PROJECT_OUTLINE.txt` predate the redesign and the Convex move. Update or fold into `ARCHITECTURE.md`.
- [ ] **Fill legal placeholders** in `lib/legal/config.ts` (entity, contact, jurisdiction) and get `/legal/*` reviewed by counsel. The subprocessor list now names Convex, Resend, and Vercel (hosting + Web Analytics) — add any OAuth providers when enabled.
- [ ] **Image compression before upload** (avatars + post images).
- [ ] **Upgrade path for Better Auth.** `@convex-dev/better-auth@0.12.x` pins `better-auth@1.6.x`; `@better-auth/core`, `@better-auth/utils`, `better-call`, and `@better-fetch/fetch` are pinned to match in `package.json`. Bump them together when the adapter supports 1.7.

---

## Recently done

Full history in [`DEVLOG.md`](DEVLOG.md). Latest: **Supabase → Convex + Better Auth + Resend migration** (2026-10-24) — new backend in `convex/`, reactive UI, passkeys, OAuth scaffolding, private post-image delivery (closes the public-bucket gap), server-side notifications.
