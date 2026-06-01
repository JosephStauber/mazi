export type Profile = {
  id: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type Post = {
  id: string;
  author_id: string;
  content: string;
  image_url: string | null;
  community_id: string | null;
  created_at: string;
};

export type PostWithAuthor = Post & {
  author: Profile;
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
  author: Profile;
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
  profile: Profile;
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
  actor: Profile | null;
  community: Pick<Community, "id" | "name" | "slug"> | null;
};
