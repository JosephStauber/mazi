/**
 * One page of a keyset-paginated list. `nextCursor` is an opaque token
 * (see `lib/utils/cursor.ts`) or `null` when there are no more rows.
 */
export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};

/** A page of profiles plus which of them the current user follows. */
export type UserPage = Page<ProfileListItem> & { followedIds: string[] };

export type Profile = {
  id: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
};

/**
 * The profile fields actually rendered when a profile is embedded as a relation
 * (post/comment author, notification actor, community member). Selecting these
 * instead of `profiles(*)` keeps `bio`/`created_at` out of every feed row.
 */
export type ProfileRef = Pick<Profile, "id" | "username" | "avatar_url">;

/** Profile fields rendered in follower/following lists (adds the shown `bio`). */
export type ProfileListItem = Pick<
  Profile,
  "id" | "username" | "avatar_url" | "bio"
>;

export type Post = {
  id: string;
  author_id: string;
  content: string;
  image_url: string | null;
  community_id: string | null;
  created_at: string;
};

export type PostWithAuthor = Post & {
  author: ProfileRef;
  community: Pick<Community, "id" | "name" | "slug"> | null;
  likes_count: number;
  comments_count: number;
  liked_by_user: boolean;
};

export type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
};

export type CommentWithAuthor = Comment & {
  author: ProfileRef;
};

export type Like = {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
};

export type Follow = {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
};

export type Community = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  creator_id: string;
  privacy_type: "public" | "invite_only";
  created_at: string;
};

export type CommunityWithMeta = Community & {
  members_count: number;
  is_member: boolean;
  role: CommunityRole | null;
};

export type CommunityRole = "member" | "moderator" | "creator";

export type CommunityMember = {
  id: string;
  community_id: string;
  user_id: string;
  role: CommunityRole;
  created_at: string;
};

export type CommunityMemberWithProfile = CommunityMember & {
  profile: ProfileRef;
};

export type InviteStatus = "pending" | "accepted" | "declined" | "expired";

export type CommunityInvite = {
  id: string;
  community_id: string;
  inviter_id: string;
  invitee_id: string | null;
  token: string | null;
  status: InviteStatus;
  expires_at: string | null;
  created_at: string;
};

export type NotificationType =
  | "like"
  | "comment"
  | "follow"
  | "community_invite"
  | "mention";

export type Notification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  post_id: string | null;
  comment_id: string | null;
  community_id: string | null;
  created_at: string;
  read: boolean;
};

export type NotificationWithActor = Notification & {
  actor: ProfileRef | null;
  community: Pick<Community, "id" | "name" | "slug"> | null;
};
