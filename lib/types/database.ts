/**
 * Wire shapes the UI renders. Convex functions return these (see
 * convex/lib/dto.ts and the matching validators in convex/lib/returns.ts), so
 * ids are Convex document ids as strings and timestamps are ISO strings.
 */

export type AccessLevel = "reserved" | "full";

export type Profile = {
  id: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  /** Pre-launch tier. `reserved` accounts can edit their profile but can't use the app. */
  access_level: AccessLevel;
};

/**
 * Pre-launch username reservation: onboarding survey answers + referral graph,
 * 1:1 with a `reserved` profile. Email is never here — it lives in auth.users.
 */
export type Reservation = {
  profile_id: string;
  reasons: string[];
  daily_social_minutes: number | null;
  referral_code: string;
  referred_by: string | null;
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

export type CommunityMemberWithProfile = Pick<CommunityMember, "id" | "role" | "created_at"> & {
  profile: ProfileRef;
};

/** A row in a follower/following list. */
export type UserListItem = ProfileListItem & { followed_by_viewer: boolean };

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

export type NotificationWithActor = Pick<
  Notification,
  "id" | "type" | "read" | "created_at" | "post_id" | "comment_id" | "community_id"
> & {
  actor: ProfileRef | null;
  community: Pick<Community, "id" | "name" | "slug"> | null;
  /** Set while a targeted invite can still be accepted/declined. */
  pending_invite_id: string | null;
};
