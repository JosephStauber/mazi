"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/nav/page-header";
import { useToast } from "@/components/ui/toast";
import { updateProfile, uploadAvatar } from "@/lib/actions/profile";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types/database";

export default function ProfileSettingsPage() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (data) setProfile(data);
    }
    load();
  }, []);

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
      setProfile((p) => (p ? { ...p, avatar_url: result.url! } : p));
      toast("Avatar updated", "success");
    }
  }

  if (!profile) {
    return (
      <div>
        <PageHeader title="Edit profile" back />
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      </div>
    );
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
