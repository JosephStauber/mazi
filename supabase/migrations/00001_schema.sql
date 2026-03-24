-- ============================================================
-- Mazi MVP — Full database schema
-- ============================================================

-- Profiles (linked to auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  email text,
  bio text,
  avatar_url text,
  created_at timestamptz default now() not null
);

-- Communities
create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  creator_id uuid references public.profiles(id) on delete cascade not null,
  privacy_type text not null check (privacy_type in ('public', 'invite_only')),
  created_at timestamptz default now() not null
);

-- Community members
create table public.community_members (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references public.communities(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text not null default 'member' check (role in ('member', 'moderator', 'creator')),
  created_at timestamptz default now() not null,
  unique(community_id, user_id)
);

-- Community invites
create table public.community_invites (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references public.communities(id) on delete cascade not null,
  inviter_id uuid references public.profiles(id) on delete cascade not null,
  invitee_id uuid references public.profiles(id) on delete cascade,
  token text unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  expires_at timestamptz,
  created_at timestamptz default now() not null
);

-- Posts
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  image_url text,
  community_id uuid references public.communities(id) on delete cascade,
  created_at timestamptz default now() not null
);

-- Comments
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now() not null
);

-- Likes
create table public.likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(post_id, user_id)
);

-- Follows
create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid references public.profiles(id) on delete cascade not null,
  following_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(follower_id, following_id)
);

-- Notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  actor_id uuid references public.profiles(id) on delete cascade,
  type text not null check (type in ('like', 'comment', 'follow', 'community_invite')),
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  created_at timestamptz default now() not null,
  read boolean default false not null
);

-- ============================================================
-- Indexes
-- ============================================================
create index idx_posts_author on public.posts(author_id);
create index idx_posts_community on public.posts(community_id);
create index idx_posts_created on public.posts(created_at desc);
create index idx_comments_post on public.comments(post_id);
create index idx_likes_post on public.likes(post_id);
create index idx_likes_user on public.likes(user_id);
create index idx_follows_follower on public.follows(follower_id);
create index idx_follows_following on public.follows(following_id);
create index idx_community_members_community on public.community_members(community_id);
create index idx_community_members_user on public.community_members(user_id);
create index idx_community_invites_token on public.community_invites(token);
create index idx_community_invites_invitee on public.community_invites(invitee_id);
create index idx_notifications_user on public.notifications(user_id);
create index idx_notifications_read on public.notifications(user_id, read);
create index idx_profiles_username on public.profiles(username);

-- ============================================================
-- Row Level Security
-- ============================================================

-- Profiles
alter table public.profiles enable row level security;

create policy "Authenticated users can view profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Posts
alter table public.posts enable row level security;

create policy "Authenticated users can view posts"
  on public.posts for select
  to authenticated
  using (true);

create policy "Users can create posts"
  on public.posts for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "Users can delete own posts"
  on public.posts for delete
  to authenticated
  using (
    auth.uid() = author_id
    or (
      community_id is not null
      and exists (
        select 1 from public.community_members
        where community_members.community_id = posts.community_id
        and community_members.user_id = auth.uid()
        and community_members.role in ('moderator', 'creator')
      )
    )
  );

-- Comments
alter table public.comments enable row level security;

create policy "Authenticated users can view comments"
  on public.comments for select
  to authenticated
  using (true);

create policy "Users can create comments"
  on public.comments for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "Users can delete own comments or mod/creator"
  on public.comments for delete
  to authenticated
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.posts p
      join public.community_members cm on cm.community_id = p.community_id
      where p.id = comments.post_id
      and cm.user_id = auth.uid()
      and cm.role in ('moderator', 'creator')
    )
  );

-- Likes
alter table public.likes enable row level security;

create policy "Authenticated users can view likes"
  on public.likes for select
  to authenticated
  using (true);

create policy "Users can create likes"
  on public.likes for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete own likes"
  on public.likes for delete
  to authenticated
  using (auth.uid() = user_id);

-- Follows
alter table public.follows enable row level security;

create policy "Authenticated users can view follows"
  on public.follows for select
  to authenticated
  using (true);

create policy "Users can create follows"
  on public.follows for insert
  to authenticated
  with check (auth.uid() = follower_id);

create policy "Users can delete own follows"
  on public.follows for delete
  to authenticated
  using (auth.uid() = follower_id);

-- Communities
alter table public.communities enable row level security;

create policy "Authenticated users can view communities"
  on public.communities for select
  to authenticated
  using (true);

create policy "Users can create communities"
  on public.communities for insert
  to authenticated
  with check (auth.uid() = creator_id);

create policy "Creator can update community"
  on public.communities for update
  to authenticated
  using (auth.uid() = creator_id);

create policy "Creator can delete community"
  on public.communities for delete
  to authenticated
  using (auth.uid() = creator_id);

-- Community members
alter table public.community_members enable row level security;

create policy "Authenticated users can view community members"
  on public.community_members for select
  to authenticated
  using (true);

create policy "Users can join or be added"
  on public.community_members for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can leave or mod can remove"
  on public.community_members for delete
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.community_members cm2
      where cm2.community_id = community_members.community_id
      and cm2.user_id = auth.uid()
      and cm2.role in ('moderator', 'creator')
    )
  );

-- Community invites
alter table public.community_invites enable row level security;

create policy "Inviter, invitee, or token resolver can view invites"
  on public.community_invites for select
  to authenticated
  using (
    auth.uid() = inviter_id
    or auth.uid() = invitee_id
    or token is not null
  );

create policy "Mod/creator can create invites"
  on public.community_invites for insert
  to authenticated
  with check (
    exists (
      select 1 from public.community_members
      where community_members.community_id = community_invites.community_id
      and community_members.user_id = auth.uid()
      and community_members.role in ('moderator', 'creator')
    )
  );

create policy "Invitee can update invite status"
  on public.community_invites for update
  to authenticated
  using (
    auth.uid() = invitee_id
    or (invitee_id is null and token is not null)
  );

-- Notifications
alter table public.notifications enable row level security;

create policy "Users can view own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "System can create notifications"
  on public.notifications for insert
  to authenticated
  with check (true);

create policy "Users can update own notifications"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id);

-- ============================================================
-- Auto-create profile on signup (trigger)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Storage buckets (run in Supabase SQL editor or via dashboard)
-- ============================================================
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
insert into storage.buckets (id, name, public) values ('post-images', 'post-images', true);

create policy "Authenticated users can upload avatars"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars');

create policy "Anyone can view avatars"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars');

create policy "Users can update own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own avatar"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Authenticated users can upload post images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'post-images');

create policy "Anyone can view post images"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'post-images');

create policy "Users can delete own post images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
