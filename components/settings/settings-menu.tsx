"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { logout, sendPasswordResetEmail } from "@/lib/actions/auth";
import { PreferenceToggle } from "@/components/settings/preference-toggle";
import { createClient } from "@/lib/supabase/client";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-background px-4 py-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

export function SettingsMenu() {
  const [email, setEmail] = useState<string | null>(null);
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setEmail(user?.email ?? null);
    }
    load();
  }, []);

  async function handlePasswordReset() {
    setPwLoading(true);
    setPwMessage(null);
    setPwError(null);
    const result = await sendPasswordResetEmail();
    if (result?.error) setPwError(result.error);
    else setPwMessage("Check your email for a link to reset your password.");
    setPwLoading(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Account, privacy, and app preferences. Profile photo, username, and
          bio are under{" "}
          <Link href="/settings/profile" className="font-medium text-foreground underline-offset-2 hover:underline">
            Edit profile
          </Link>
          .
        </p>
      </div>

      <Section
        title="Profile & appearance"
        description="Update how you appear to others on Mazi."
      >
        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
          <p className="text-sm text-muted-foreground">
            Avatar, username, and bio
          </p>
          <Link
            href="/settings/profile"
            className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-transparent px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Edit profile
          </Link>
        </div>
      </Section>

      <Section
        title="Account"
        description="Sign-in email and password are managed through Supabase Auth."
      >
        <div className="space-y-2 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Email
          </p>
          <p className="text-sm text-foreground break-all">
            {email ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            To change your email, contact support or use your provider’s account
            settings if you signed in with OAuth (when enabled).
          </p>
        </div>
        <div className="space-y-2 py-3">
          <p className="text-sm font-medium text-foreground">Password</p>
          <p className="text-xs text-muted-foreground">
            We’ll email you a secure link to choose a new password.
          </p>
          {pwError && (
            <p className="text-sm text-red-600 dark:text-red-400">{pwError}</p>
          )}
          {pwMessage && (
            <p className="text-sm text-green-700 dark:text-green-400">
              {pwMessage}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={pwLoading}
            onClick={handlePasswordReset}
          >
            Send password reset email
          </Button>
        </div>
      </Section>

      <Section
        title="Notifications"
        description="Preferences are stored on this device. In-app notifications still use your account."
      >
        <PreferenceToggle
          storageKey="mazi_pref_notif_likes"
          label="Likes"
          description="Get notified when someone likes your posts."
          defaultOn
        />
        <PreferenceToggle
          storageKey="mazi_pref_notif_comments"
          label="Comments"
          description="Get notified when someone comments on your posts."
          defaultOn
        />
        <PreferenceToggle
          storageKey="mazi_pref_notif_follows"
          label="New followers"
          description="Get notified when someone follows you."
          defaultOn
        />
        <PreferenceToggle
          storageKey="mazi_pref_notif_invites"
          label="Community invites"
          description="Get notified when you’re invited to a community."
          defaultOn
        />
      </Section>

      <Section
        title="Privacy"
        description="These options affect this app on this device only until account-level privacy ships."
      >
        <PreferenceToggle
          storageKey="mazi_pref_private_profile"
          label="Suggest private profile"
          description="Reminder to keep personal details out of public posts; does not hide your profile from followers."
          defaultOn={false}
        />
        <PreferenceToggle
          storageKey="mazi_pref_show_online"
          label="Show activity status"
          description="When supported, lets friends see when you’re active."
          defaultOn
        />
      </Section>

      <Section
        title="Security"
        description="Session and sign-in controls."
      >
        <div className="py-3">
          <p className="text-sm text-muted-foreground mb-3">
            Sign out on this device. Use password reset if you’re concerned
            someone else had access.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await logout();
              window.location.href = "/login";
            }}
          >
            Log out
          </Button>
        </div>
      </Section>

      <Section
        title="Your data"
        description="Export and deletion requests."
      >
        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Download your data
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Request a copy of posts and profile data (coming soon).
            </p>
          </div>
          <Button variant="outline" size="sm" disabled>
            Request download
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Delete account
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently remove your account and content. Irreversible.
            </p>
          </div>
          <Button variant="danger" size="sm" disabled title="Contact support">
            Delete account
          </Button>
        </div>
      </Section>

      <Section title="Help">
        <Link
          href="/home"
          className="block py-3 text-sm text-foreground hover:underline"
        >
          Home feed
        </Link>
        <Link
          href="/communities"
          className="block py-3 text-sm text-foreground hover:underline"
        >
          Communities
        </Link>
        <p className="py-3 text-xs text-muted-foreground">
          Help center and reporting tools can be linked here as the product grows.
        </p>
      </Section>
    </div>
  );
}
