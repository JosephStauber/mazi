"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { updateProfile, uploadAvatar } from "@/lib/actions/profile";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types/database";

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    setMessage(null);
    const result = await updateProfile(formData);
    if (result?.error) setError(result.error);
    else setMessage("Profile updated");
    setLoading(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("avatar", file);
    const result = await uploadAvatar(formData);
    if (result?.error) setError(result.error);
    else if (result?.url) {
      setProfile((p) => (p ? { ...p, avatar_url: result.url! } : p));
      setMessage("Avatar updated");
    }
  }

  if (!profile) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <Link
          href="/settings"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to settings
        </Link>
        <h1 className="mt-3 text-xl font-bold">Edit profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Photo, username, and bio. Other account options are in{" "}
          <Link href="/settings" className="text-foreground underline-offset-2 hover:underline">
            Settings
          </Link>
          .
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar src={profile.avatar_url} alt={profile.username} size="lg" />
          <label className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground">
            Change avatar
            <input
              type="file"
              accept="image/*"
              className="hidden"
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
          {error && <p className="text-sm text-red-500">{error}</p>}
          {message && <p className="text-sm text-green-600">{message}</p>}
          <Button type="submit" loading={loading}>
            Save changes
          </Button>
        </form>
      </div>
    </div>
  );
}
