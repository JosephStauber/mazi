"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/nav/page-header";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/utils/errors";
import { uploadImage } from "@/lib/utils/upload";
import { AVATAR_MAX_BYTES } from "@/lib/validators/post";

/**
 * Edit-profile form. Used by full accounts (/settings/profile) and reserved
 * ones (/welcome/profile), so it reads the profile itself rather than relying
 * on the app shell's viewer context.
 */
export function ProfileSettingsForm() {
  const { toast } = useToast();
  const profile = useQuery(api.profiles.me);
  const updateProfile = useMutation(api.profiles.update);
  const setAvatar = useMutation(api.profiles.setAvatar);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleProfileUpdate(formData: FormData) {
    setLoading(true);
    try {
      await updateProfile({
        username: (formData.get("username") as string) || undefined,
        bio: (formData.get("bio") as string | null) ?? undefined,
      });
      toast("Profile updated", "success");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > AVATAR_MAX_BYTES) {
      toast("File must be under 2MB", "error");
      return;
    }
    setUploading(true);
    try {
      const storageId = await uploadImage(file, () => generateUploadUrl());
      await setAvatar({ storageId });
      toast("Avatar updated", "success");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <PageHeader title="Edit profile" back />

      {!profile ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-6 pt-5">
          <div className="flex items-center gap-4">
            <Avatar src={profile.avatar_url} alt={profile.username} size="lg" />
            <label className="cursor-pointer rounded-full border border-border px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">
              {uploading ? "Uploading…" : "Change photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                disabled={uploading}
                onChange={handleAvatarUpload}
              />
            </label>
          </div>

          {/* Keyed by id so defaults reset if the profile identity changes. */}
          <form key={profile.id} action={handleProfileUpdate} className="space-y-4">
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
      )}
    </div>
  );
}
