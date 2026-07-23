-- ============================================================
-- 00009 — Bind mention notifications to the referenced comment's post
-- Run in the Supabase SQL editor AFTER 00001–00008.
-- Idempotent: safe to re-run.
--
-- 00006 (D) bound the `comment` branch's comment_id to its post_id, but the
-- `mention` branch's comment sub-case was left checking only that the actor
-- authored comment_id and that its content mentions the recipient — never that
-- the comment actually lives on notifications.post_id. So an actor could fire a
-- genuine @mention notification (real comment they authored, really mentioning
-- the recipient) while pointing post_id at an unrelated post, so the recipient's
-- notification links to a post of the actor's choosing.
--
-- Re-create the whole INSERT policy, tightening only the mention comment
-- sub-branch (add `c.post_id = notifications.post_id`, mirroring the 00006/D
-- fix). Every other branch is reproduced verbatim from 00006. The app's
-- notifyMentions already sets post_id to the comment's post, so legitimate
-- inserts are unaffected.
-- ============================================================
drop policy if exists "Users can create legitimate notifications" on public.notifications;
create policy "Users can create legitimate notifications"
  on public.notifications for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and (
      -- Like: the actor liked the recipient's post.
      (
        type = 'like'
        and post_id is not null
        and exists (
          select 1 from public.likes l
          join public.posts p on p.id = l.post_id
          where l.post_id = notifications.post_id
            and l.user_id = auth.uid()
            and p.author_id = notifications.user_id
        )
      )
      -- Comment: the actor authored comment_id, that comment lives on post_id,
      -- and the recipient is the post's author OR the parent comment's author.
      or (
        type = 'comment'
        and comment_id is not null
        and post_id is not null
        and exists (
          select 1 from public.comments c
          where c.id = notifications.comment_id
            and c.author_id = auth.uid()
            and c.post_id = notifications.post_id
        )
        and (
          exists (
            select 1 from public.posts p
            where p.id = notifications.post_id
              and p.author_id = notifications.user_id
          )
          or exists (
            select 1 from public.comments c
            join public.comments parent on parent.id = c.parent_id
            where c.id = notifications.comment_id
              and parent.author_id = notifications.user_id
          )
        )
      )
      -- Follow: the actor follows the recipient.
      or (
        type = 'follow'
        and exists (
          select 1 from public.follows f
          where f.follower_id = auth.uid()
            and f.following_id = notifications.user_id
        )
      )
      -- Community invite: the actor invited the recipient.
      or (
        type = 'community_invite'
        and community_id is not null
        and exists (
          select 1 from public.community_invites i
          where i.community_id = notifications.community_id
            and i.inviter_id = auth.uid()
            and i.invitee_id = notifications.user_id
        )
      )
      -- Mention: the recipient's @username appears in the actor's own post/comment
      -- that this notification points at. For the comment case the referenced
      -- comment must also live on post_id (00009 — mirrors the 00006/D binding),
      -- so a real mention can't be relinked to an unrelated post.
      or (
        type = 'mention'
        and exists (
          select 1 from public.profiles pr
          where pr.id = notifications.user_id
            and (
              case
                when notifications.comment_id is not null then exists (
                  select 1 from public.comments c
                  where c.id = notifications.comment_id
                    and c.author_id = auth.uid()
                    and c.post_id = notifications.post_id
                    and c.content ~ ('(^|[^a-zA-Z0-9_@])@' || pr.username || '($|[^a-zA-Z0-9_])')
                )
                else exists (
                  select 1 from public.posts p
                  where p.id = notifications.post_id
                    and p.author_id = auth.uid()
                    and p.content ~ ('(^|[^a-zA-Z0-9_@])@' || pr.username || '($|[^a-zA-Z0-9_])')
                )
              end
            )
        )
      )
    )
  );
