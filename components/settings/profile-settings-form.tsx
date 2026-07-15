"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/nav/page-header";
import { useToast } from "@/components/ui/toast";
import { updateProfile, uploadAvatar } from "@/lib/actions/profile";
import type { Profile } from "@/lib/types/database";

/**
 * Edit-profile form. The initial profile is server-rendered by the page and
 * passed in, so the form doesn't make a browser auth/profile round trip on
 * mount; local state only tracks post-save changes (e.g. a new avatar).
 */
export function ProfileSettingsForm({
  initialProfile,
}: {
  initialProfile: Profile;
}) {
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleProfileUpdate(formData: FormData) {
    setLoading(true);
    const result = await updateProfile(formData);
    setLoading(false);
    if (result?.error) toast(result.error, "error");
    else toast("Profile updated", "success");
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("avatar", file);
    const result = await uploadAvatar(formData);
    setUploading(false);
    if (result?.error) toast(result.error, "error");
    else if (result?.url) {
      setProfile((p) => ({ ...p, avatar_url: result.url! }));
      toast("Avatar updated", "success");
    }
  }

  return (
    <div>
      <PageHeader title="Edit profile" back />

      <div className="space-y-6 pt-5">
        <div className="flex items-center gap-4">
          <Avatar src={profile.avatar_url} alt={profile.username} size="lg" />
          <label className="cursor-pointer rounded-full border border-border px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">
            {uploading ? "Uploading…" : "Change photo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={handleAvatarUpload}
            />
          </label>
        </div>

        <form action={handleProfileUpdate} className="space-y-4">
          <Input
            id="username"
            name="username"
            label="Username"
            defaultValue={profile.username}
          />
          <Textarea
            id="bio"
            name="bio"
            label="Bio"
            defaultValue={profile.bio ?? ""}
            maxLength={160}
            placeholder="Tell people about yourself"
          />
          <Button type="submit" loading={loading}>
            Save changes
          </Button>
        </form>
      </div>
    </div>
  );
}
