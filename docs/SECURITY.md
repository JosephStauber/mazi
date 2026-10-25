# SECURITY

The security model for Mazi, a privacy-first app. Read this before changing anything touching data access, auth, storage, or the Convex functions. Schema detail is in [`DATABASE.md`](DATABASE.md); rationale in [`DECISIONS.md`](DECISIONS.md) (D11 covers the move off Supabase).

> **No secrets in this repo.** Examples below use placeholders. Server secrets live on the Convex deployment (`npx convex env set …` / dashboard); `.env.local` holds only public `NEXT_PUBLIC_*` URLs and is gitignored.

## Trust boundary

The browser talks to Convex directly (WebSocket) with the user's Better Auth–issued JWT. **Any public query/mutation can be called by anyone with any arguments.** Therefore:

- **Each public Convex function is its own security boundary.** There is no row-level security underneath it. A function that forgets an access check leaks or corrupts data — nothing else will catch it.
- **All access rules live in `convex/lib/access.ts`** and every public function calls them before reading or writing: `requireViewer` (signed in), `requireFullAccess` (signed in *and* `accessLevel = "full"`), `canViewPost` / `requireVisiblePost`, `getMembership`, `canModeratePost`, `isModeratorRole`. Add new rules there, not inline.
- **Identity always comes from `ctx.auth.getUserIdentity()`** (via `getViewer`), never from an argument. Arguments like `userId` are only ever *targets* (whose followers to list), never "who am I".
- **Internal functions** (`internalQuery` / `internalMutation`) are not client-callable — use them for anything privileged (`admin:grant`, `admin:setSignupMode`, `profiles:isUsernameTaken`).
- **Return validators** (`convex/lib/returns.ts`) are declared on public functions so a response can't accidentally include fields like `authUserId`.
- The Next.js `proxy.ts` and the server layouts' redirects are **UX only**.

## Auth (Better Auth on Convex)

- Better Auth runs inside Convex as the `betterAuth` component (local install — `convex/betterAuth/`). The Next.js app proxies `/api/auth/*` to it so session cookies are first-party; Convex receives a short-lived JWT, validated through `convex/auth.config.ts`.
- **Email + password**: verification is **required** before first sign-in (`requireEmailVerification`), password reset by emailed link (1h expiry), sessions revoked on reset. The password policy (8+, upper/lower/digit — `passwordSchema`) is enforced in a Better Auth `before` hook on `/sign-up/email` and `/reset-password`, not just in the forms.
- **Passkeys** (`@better-auth/passkey`): users add them in Settings and can sign in with them. `rpID`/`origin` derive from `SITE_URL`, so it must be the real origin.
- **Google / Apple**: wired but off until `GOOGLE_CLIENT_ID/SECRET` / `APPLE_CLIENT_ID/SECRET` are set on the deployment. `auth:providers` tells the UI which buttons to render. Account linking is limited to those trusted providers.
- **Rate limits**: Better Auth's limiter with **database storage** (so it holds across stateless function instances): sign-up 10/h, sign-in 10/min, reset + verification emails 5/h, 100/min default — per IP.
- **Account deletion** is Better Auth `deleteUser` (requires the password unless the session is < 1 day old). The `user.onDelete` trigger erases all app data in the same transaction (`deleteAllDataForAuthUser`).

## Access tiers (pre-launch)

- `profiles.accessLevel` is `reserved` or `full`. **Only server code writes it**: the signup trigger (`createProfileForAuthUser`) sets it from `appConfig.signupMode` (missing row ⇒ `reservation`), and `admin:setSignupMode { promoteReserved }` promotes. No public mutation accepts it — `profiles:update` only takes `username` + `bio`.
- Client-supplied `signupMeta` (username + survey + referral) is parsed defensively (`convex/lib/signup.ts`): canonical reasons only, minutes clamped, bounded referral code, self/unknown referrals dropped. It never influences the tier.
- Reserved accounts can read/update only their own profile, avatar, and reservation. Everything else goes through `requireFullAccess` and throws for them.

## Suspension

- An admin can suspend an account (`admin:suspendUser`, reason required and shown to the user). `profiles.suspendedAt` set ⇒ `requireViewer` (and so `requireFullAccess`) throws and `getFullAccessViewer` returns null, so **every** app function fails closed without checking suspension itself.
- A suspended account keeps only its data rights: `account:exportMyData` and `account:mySuspension` use `requireAccountOwner` / `getViewer`. Deleting the account goes through Better Auth (unaffected). Don't use `requireAccountOwner` for anything else.
- Admins can't be suspended (revoke admin first); suspending yourself is refused. Their existing posts stay visible — removal is a separate (future) action.
- Layouts redirect suspended users to `/suspended`; `AppShell` watches `account:mySuspension` live, and `app/(protected)/error.tsx` keeps the shell mounted so that redirect still fires when queries start throwing mid-session.

## Access rules by area

| Area | Read | Write |
|------|------|-------|
| Profiles | `me`: own (any tier). `byUsername`, lists, search: full users, reserved profiles hidden | `update` / `setAvatar`: own row only (any tier); username case-insensitive unique |
| Posts | personal posts → any full user; community posts → author, any member, or anyone if the community is public (`canViewPost`) | create: full user, **member** if `communityId`; edit: author, membership re-checked; delete: author or community creator/moderator |
| Comments | only on posts the viewer can see | create: post must be visible, parent must be on the same post (replies attach to the thread root); edit: author + post still visible; delete: author or community creator/moderator |
| Likes | counts on visible posts | toggle: post must be visible |
| Follows | lists to any full user | toggle: self only, not yourself, target must be a full user |
| Communities | list/bySlug/members to any full user | create: full user; update/delete: creator only; join: **public only**; leave: not the creator |
| Invites | `inviteByToken`: pending + unexpired only, public community fields | create (targeted or link): creator/moderator; accept: link = reusable, targeted = invitee only and only from `pending`; decline: targeted invitee, pending only |
| Notifications | recipient only | **no client writes at all** — created server-side inside the action that caused them (`convex/lib/notify.ts`); mentions only notify users who can see the post. mark read: recipient only |
| Reservations | `reservations:mine`: owner only (referral count = confirmed signups) | trigger-written only |
| Admin | every public `admin:*` function starts with `requireAdmin` (allowlist + not suspended, in `access.ts`); `reservationList` is the **only** path that returns emails — the Users page doesn't | `suspendUser` / `unsuspendUser`: admin, written to `adminActions` in the same mutation. `admin:grant` / `admin:setSignupMode` are internal (CLI / dashboard only) and audited with no actor. No function edits or deletes audit rows |

## Files

- Uploads use Convex storage: the client gets a one-time upload URL (`files:generateUploadUrl`, signed-in only, rate-limited per account), uploads, then passes the storage id to `posts:create` / `profiles:setAvatar`.
- **Unclaimed uploads are deleted**: `files:sweepOrphanedUploads` runs hourly (`convex/crons.ts`) and deletes `_storage` files over a day old that no `profiles.avatarId` / `posts.imageId` references. It walks storage from a saved cursor (`jobState`), so each file is checked once.
- `claimImage` (`convex/files.ts`) validates the **stored** file's metadata — content type must be JPEG/PNG/WebP/GIF (no SVG/HTML), size ≤ 5 MB (post) / 2 MB (avatar) — and rejects a storage id already attached to anything (so an id seen in someone's avatar URL can't be re-attached). Rejected files are deleted.
- **Post images are private**: the UI never gets a storage URL. `<img>` points at `/api/images/[postId]`, a Next.js route that runs `files:postImageUrl` *as the viewer* (re-checking post visibility) and streams the bytes with `Cache-Control: private`, `nosniff`, and a sandboxing CSP. Invite-only community images are therefore not reachable by URL-sharing. (Closes the old public-bucket gap.)
- **Avatars are public-by-URL** (Convex storage URLs are unguessable but unauthenticated). Deliberate: avatars are shown to every user anyway.

## Secrets & configuration

- **Convex deployment env** (server-only): `SITE_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, optional `GOOGLE_*` / `APPLE_*`. Never put these in `.env.local` or the repo.
- **`.env.local`** (public): `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL` (optional, derived), `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_LAUNCH_MODE`.
- Without `RESEND_API_KEY`, auth emails are **logged** to the Convex logs instead of sent (dev fallback) — never run production like that.

## Rate limits

- **Auth** (Better Auth, per IP): see "Rate limits" under Auth above.
- **App writes** (`convex/lib/rateLimit.ts`, `@convex-dev/rate-limiter`, per account, token buckets): post 30/h (burst 10), comment 120/h (20), edit 60/h (20), like 300/h (60), follow 100/h (30), invite 60/h (20), create community 10/day (3), upload URL 60/h (20), profile/avatar update 30/h (10). Call `enforceRateLimit(ctx, name, viewer._id)` right after the viewer check in any new write that a script could loop; a denial throws a user-safe `ConvexError` and rolls back, so nothing is spent on failed writes.
- **Queries can't be rate-limited in Convex** (they can't write state, and functions don't see the client IP). Public/expensive queries must stay cheap instead: `profiles:usernameAvailable` and `auth:providers` are single lookups; `search:all` is bounded (`take(20)`).

## Input validation

- Shared Zod schemas in `lib/validators/` run on the server via `parseOrDeny` (post ≤ 2000, comment ≤ 1000, bio ≤ 160, username `^[a-zA-Z0-9_]{3,30}$`, community name/description limits). Client checks are UX only.
- User text renders through `RichText` (React nodes; mentions → links). **Never** `dangerouslySetInnerHTML` on user content.
- Errors meant for users are thrown as `ConvexError(message)`; the client shows them via `errorMessage()` and shows a generic message for anything else.

## Known notes / residuals

- **No CAPTCHA** on signup/reserve yet — Better Auth's IP rate limit is the only anti-abuse control (TODO).
- **`profiles:usernameAvailable` is public and not rate-limited** (Convex queries can't write). It returns only a boolean; handles are public on the platform anyway.
- **Large cascades**: account/community deletion runs in one Convex transaction. Fine at current scale; a very large account could hit transaction limits (TODO: move to a batched/scheduled deletion).
- **Legal placeholders** — `lib/legal/config.ts` contact/entity fields are not real; policy copy needs counsel review.
- **Moderator role** is dormant (no assignment path) by design — see `DECISIONS.md` D9.

## Handling a security fix

1. Reproduce against the **Convex function** (call it directly with `npx convex run` or from the browser console), not just the UI.
2. Fix in `convex/lib/access.ts` (or the function), keeping the rule in one place. Add a return validator if a response could over-share.
3. Log it in `DEVLOG.md` and update the table above.
