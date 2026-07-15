"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  logout,
  sendPasswordResetEmail,
  deleteAccount,
} from "@/lib/actions/auth";
import { exportMyData } from "@/lib/actions/account";
import { PreferenceToggle } from "@/components/settings/preference-toggle";

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

export function SettingsMenu({ email }: { email: string | null }) {
  const { toast } = useToast();
  const [pwLoading, setPwLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handlePasswordReset() {
    setPwLoading(true);
    const result = await sendPasswordResetEmail();
    setPwLoading(false);
    if (result?.error) toast(result.error, "error");
    else toast("Check your email for a link to reset your password.", "success");
  }

  async function handleExport() {
    setExporting(true);
    const result = await exportMyData();
    setExporting(false);
    if (result?.error || !result?.data) {
      toast(result?.error ?? "Couldn't export your data", "error");
      return;
    }
    const blob = new Blob([JSON.stringify(result.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mazi-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Your data is downloading", "success");
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteAccount();
    if (result?.error) {
      setDeleting(false);
      toast(result.error, "error");
      return;
    }
    window.location.href = "/";
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
              Get a copy of your profile, posts, comments, and connections as
              JSON.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            loading={exporting}
            onClick={handleExport}
          >
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
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmDelete(true)}
          >
            Delete account
          </Button>
        </div>
      </Section>

      <Section
        title="Legal"
        description="The policies that govern your use of Mazi."
      >
        <Link
          href="/legal/privacy"
          className="block py-3 text-sm text-foreground hover:underline"
        >
          Privacy Policy
        </Link>
        <Link
          href="/legal/terms"
          className="block py-3 text-sm text-foreground hover:underline"
        >
          Terms of Service
        </Link>
        <Link
          href="/legal/guidelines"
          className="block py-3 text-sm text-foreground hover:underline"
        >
          Community Guidelines
        </Link>
        <Link
          href="/legal/cookies"
          className="block py-3 text-sm text-foreground hover:underline"
        >
          Cookie Notice
        </Link>
      </Section>

      <Modal
        open={confirmDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
        title="Delete your account?"
        description="This permanently removes your profile, posts, comments, likes, follows, and uploaded images. This cannot be undone."
      >
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => setConfirmDelete(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>
            Delete account
          </Button>
        </div>
      </Modal>
    </div>
  );
}
