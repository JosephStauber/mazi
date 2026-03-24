# Mazi

A minimalist, privacy-first social platform. No algorithm. No ads. Just people.

## Tech stack

- **Next.js 16** (App Router) with TypeScript
- **Tailwind CSS** — black-and-white minimal aesthetic
- **Supabase** — Postgres, Auth, Storage, Row Level Security
- **Zod** — form validation
- **nanoid** — invite link token generation

## Getting started

### 1. Clone and install

```bash
cd proto
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key
3. Copy `.env.example` to `.env.local` and fill in the values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Run the database migration

Open the Supabase SQL Editor and run the contents of:

```
supabase/migrations/00001_schema.sql
```

This creates all tables, indexes, RLS policies, storage buckets, and the auto-profile trigger.

### 4. Configure Supabase Auth

- Go to **Authentication → Providers** and ensure **Email** is enabled
- Optionally disable email confirmation for development (Authentication → Settings → toggle off "Enable email confirmations")

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
├── app/
│   ├── (auth)/              # Login, signup (public)
│   ├── (protected)/         # All authenticated routes
│   │   ├── home/            # Feed with Following + Communities tabs
│   │   ├── profile/[username]/
│   │   ├── settings/
│   │   ├── communities/
│   │   ├── communities/[slug]/
│   │   ├── communities/join/ # Invite link resolution
│   │   ├── post/[id]/
│   │   ├── notifications/
│   │   └── search/
│   ├── page.tsx             # Landing page (public)
│   ├── layout.tsx           # Root layout
│   ├── error.tsx
│   └── not-found.tsx
├── components/
│   ├── ui/                  # Button, Input, Textarea, Avatar, Card, EmptyState
│   ├── nav/                 # DesktopNav, MobileNav
│   ├── post/                # PostCard, PostComposer
│   ├── comment/             # CommentList
│   ├── feed/                # FeedTabs
│   ├── community/           # CommunityCard, JoinLeaveButton, InvitePanel, CreateCommunityForm
│   ├── notification/        # NotificationItem, MarkAllReadButton
│   ├── profile/             # FollowButton
│   └── search/              # SearchView
├── lib/
│   ├── supabase/            # Client (browser), server, middleware helpers
│   ├── types/               # Shared TypeScript types (database models)
│   ├── validators/          # Zod schemas (auth, profile, post, comment, community)
│   ├── queries/             # Server-side read functions (profiles, posts, feed, communities, notifications, search)
│   ├── actions/             # Server actions (auth, profile, post, comment, follow, community, notification)
│   └── utils/               # Helpers (date formatting)
├── hooks/                   # (Reserved for client hooks)
├── supabase/
│   └── migrations/          # SQL migration files
├── middleware.ts             # Auth redirect middleware
└── .env.example
```

## Database schema

Tables: `profiles`, `posts`, `comments`, `likes`, `follows`, `communities`, `community_members`, `community_invites`, `notifications`

All tables have Row Level Security enabled. Key policies:

- Users can only edit/delete their own data
- Community moderators and creators can delete posts/comments in their community
- Notifications are private to the recipient
- Invites can be created by moderators/creators, resolved by invitees or via token

A database trigger auto-creates a `profiles` row when a new `auth.users` record is inserted.

## Features

### Feed
- Two tabs: **Following** (posts from followed users) and **Communities** (posts from joined communities)
- Strict reverse chronological order — no algorithm

### Posts
- Text posts with optional image upload
- Choose destination: personal timeline or a specific community
- Like / unlike, comment, delete own

### Communities
- Public or invite-only
- Creator and moderator roles
- Invite by username (sends notification) or shareable invite link (token)
- Accept / decline invites from notifications or invite link page

### Notifications
- Like, comment, follow, community invite
- Unread badge in nav
- Mark individual or all as read
- Accept/decline community invites inline

### Search
- Users by username
- Communities by name
- No algorithm, no recommendations

## Mobile app reuse

All business logic lives in `lib/` — types, validators, queries, and actions are decoupled from Next.js page components. When building a React Native / Expo app:

1. Extract `lib/types/`, `lib/validators/` directly (zero changes needed)
2. Replace `lib/supabase/server.ts` with a mobile Supabase client
3. Adapt `lib/queries/` and `lib/actions/` to use the mobile client

## Design principles

- Black-and-white minimalist aesthetic
- Clean typography (Geist Sans)
- Card-based but restrained — lots of whitespace
- Responsive: top nav on desktop, bottom nav on mobile
- No bright colors except for error states

## Next steps

- Expo / React Native mobile app (reuse `lib/`)
- Invite link expiry and single-use tokens
- Moderator assignment UI (creator assigns mods)
- Block / mute users
- Infinite scroll / pagination for feeds
- Real-time updates via Supabase Realtime
