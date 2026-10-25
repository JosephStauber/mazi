"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useAdminRole } from "@/components/admin/admin-role";
import { AuditEntryRow } from "@/components/admin/audit-log";
import { UserBadges, type AdminUser } from "@/components/admin/user-admin";
import { formatJoinDate, formatRelative } from "@/lib/utils/date";
import { errorMessage } from "@/lib/utils/errors";
import {
  adminNoteSchema,
  SUSPEND_DURATIONS,
  suspendReasonSchema,
  type SuspendDuration,
} from "@/lib/validators/admin";

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

const empty = (text: string) => <p className="text-sm text-muted-foreground">{text}</p>;

export function UserDetail({ profileId }: { profileId: Id<"profiles"> }) {
  const data = useQuery(api.admin.user, { profileId });
  const role = useAdminRole();
  const { toast } = useToast();
  const unsuspend = useMutation(api.admin.unsuspendUser);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);

  if (data === undefined) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Spinner />
      </div>
    );
  }
  if (data === null) {
    return (
      <div className="space-y-4">
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-foreground">
          ← Users
        </Link>
        {empty("This account doesn't exist (it may have been deleted).")}
      </div>
    );
  }

  const { user } = data;

  async function restore() {
    if (!window.confirm(`Restore @${user.username}? They'll regain access and get an email.`)) return;
    setRestoring(true);
    try {
      await unsuspend({ profileId });
      toast(`@${user.username} restored`, "success");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-foreground">
        ← Users
      </Link>

      <header className="flex flex-wrap items-start gap-4">
        <Avatar src={user.avatar_url} alt={user.username} size="lg" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="brand text-3xl text-foreground">@{user.username}</h1>
            <UserBadges user={user} />
          </div>
          <p className="text-sm text-muted-foreground">
            Joined {formatJoinDate(user.created_at)} · {user.post_count} posts ·{" "}
            {user.follower_count} followers · {user.following_count} following ·{" "}
            <Link href={`/profile/${user.username}`} className="underline underline-offset-2">
              public profile
            </Link>
          </p>
          {data.bio && <p className="text-sm text-foreground">{data.bio}</p>}
          {role === "owner" && <RevealEmail profileId={profileId} />}
        </div>
        <div className="flex flex-wrap gap-2">
          {user.suspended_at ? (
            <Button variant="outline" size="sm" loading={restoring} onClick={restore}>
              Restore
            </Button>
          ) : (
            !user.admin_role && (
              <Button variant="danger" size="sm" onClick={() => setSuspendOpen(true)}>
                Suspend
              </Button>
            )
          )}
          <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
            Reset profile
          </Button>
        </div>
      </header>

      {user.suspended_at && (
        <div className="rounded-[var(--radius-md)] border border-danger/40 bg-surface p-4 text-sm">
          <p className="font-medium text-foreground">
            Suspended {formatRelative(user.suspended_at)} —{" "}
            {user.suspended_until
              ? `until ${new Date(user.suspended_until).toLocaleString()}`
              : "until restored"}
          </p>
          {user.suspended_reason && (
            <p className="mt-1 text-muted-foreground">“{user.suspended_reason}”</p>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Notes profileId={profileId} notes={data.notes} />

        <Section
          title="History"
          action={
            <Link
              href={`/admin/audit?target=${profileId}`}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Full log →
            </Link>
          }
        >
          {data.history.length === 0 ? (
            empty("No admin actions on this account.")
          ) : (
            <ol className="-mx-4 -my-3 divide-y divide-border">
              {data.history.map((e) => (
                <AuditEntryRow key={e.id} entry={e} />
              ))}
            </ol>
          )}
        </Section>

        <Section title="Appeals">
          {data.appeals.length === 0 ? (
            empty("No appeals.")
          ) : (
            <ul className="space-y-3">
              {data.appeals.map((a) => (
                <li key={a.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={a.status === "open" ? "solid" : "outline"}>{a.status}</Badge>
                    <span className="text-xs text-muted-foreground">{formatRelative(a.created_at)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-foreground">{a.body}</p>
                  {a.response && <p className="mt-1 text-muted-foreground">Reply: {a.response}</p>}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Communities created">
          {data.communities.length === 0 ? (
            empty("None.")
          ) : (
            <ul className="space-y-1.5 text-sm">
              {data.communities.map((c) => (
                <li key={c.id} className="flex justify-between gap-3">
                  <Link href={`/communities/${c.slug}`} className="text-foreground underline-offset-2 hover:underline">
                    {c.name}
                  </Link>
                  <span className="text-muted-foreground">{c.member_count} members</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <SuspendModal user={suspendOpen ? user : null} onClose={() => setSuspendOpen(false)} />
      <ResetProfileModal user={resetOpen ? user : null} onClose={() => setResetOpen(false)} />
    </div>
  );
}

function RevealEmail({ profileId }: { profileId: Id<"profiles"> }) {
  const reveal = useMutation(api.admin.revealEmail);
  const { toast } = useToast();
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  if (email !== undefined) {
    return <p className="text-sm text-foreground">{email ?? "No email on file"}</p>;
  }
  return (
    <button
      type="button"
      disabled={busy}
      className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
      onClick={async () => {
        setBusy(true);
        try {
          setEmail(await reveal({ profileId }));
        } catch (e) {
          toast(errorMessage(e), "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      Reveal email (logged in the audit log)
    </button>
  );
}

type Note = { id: string; author_username: string | null; is_mine: boolean; body: string; created_at: string };

function Notes({ profileId, notes }: { profileId: Id<"profiles">; notes: Note[] }) {
  const role = useAdminRole();
  const { toast } = useToast();
  const add = useMutation(api.admin.addNote);
  const remove = useMutation(api.admin.deleteNote);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = adminNoteSchema.safeParse(body);
    if (!parsed.success) {
      toast(parsed.error.issues[0]?.message ?? "Invalid note", "error");
      return;
    }
    setBusy(true);
    try {
      await add({ profileId, body: parsed.data });
      setBody("");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Admin notes">
      <p className="mb-3 text-xs text-muted-foreground">
        Visible to admins only, never to the user. Deleted if the account is deleted.
      </p>
      <div className="space-y-2">
        <Textarea
          id="admin-note"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Context for other admins…"
          maxLength={2000}
        />
        <div className="flex justify-end">
          <Button size="sm" variant="outline" loading={busy} onClick={submit}>
            Add note
          </Button>
        </div>
      </div>
      {notes.length > 0 && (
        <ul className="mt-4 space-y-3 border-t border-border pt-3">
          {notes.map((n) => (
            <li key={n.id} className="text-sm">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {n.author_username ? `@${n.author_username}` : "former admin"} ·{" "}
                  {formatRelative(n.created_at)}
                </span>
                {(n.is_mine || role === "owner") && (
                  <button
                    type="button"
                    className="hover:text-foreground"
                    onClick={async () => {
                      if (!window.confirm("Delete this note?")) return;
                      try {
                        await remove({ noteId: n.id as Id<"adminNotes"> });
                      } catch (e) {
                        toast(errorMessage(e), "error");
                      }
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-foreground">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

const selectClass =
  "h-11 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 text-[15px] text-foreground focus-visible:outline-none focus-visible:border-foreground";

function SuspendModal({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const { toast } = useToast();
  const suspend = useMutation(api.admin.suspendUser);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<SuspendDuration>("7d");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setReason("");
    setDuration("7d");
    setError(null);
    onClose();
  }

  async function submit() {
    if (!user) return;
    const parsed = suspendReasonSchema.safeParse(reason);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid reason");
      return;
    }
    setBusy(true);
    try {
      await suspend({ profileId: user.id as Id<"profiles">, reason: parsed.data, duration });
      toast(`@${user.username} suspended`, "success");
      close();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={user !== null}
      onClose={close}
      title={user ? `Suspend @${user.username}?` : undefined}
      description="They're signed out everywhere and emailed the reason. They can sign back in only to read it, appeal, or download their data. Their posts stay up."
    >
      <div className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="suspend-duration" className="block text-sm font-medium text-foreground">
            Length
          </label>
          <select
            id="suspend-duration"
            className={selectClass}
            value={duration}
            onChange={(e) => setDuration(e.target.value as SuspendDuration)}
          >
            {(Object.keys(SUSPEND_DURATIONS) as SuspendDuration[]).map((d) => (
              <option key={d} value={d}>
                {SUSPEND_DURATIONS[d].label}
              </option>
            ))}
          </select>
        </div>
        <Textarea
          id="suspend-reason"
          label="Reason (shown to the user)"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={error ?? undefined}
          maxLength={500}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} onClick={submit}>
            Suspend
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ResetProfileModal({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const { toast } = useToast();
  const reset = useMutation(api.admin.resetProfile);
  const [fields, setFields] = useState({ bio: false, avatar: false, username: false });
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setFields({ bio: false, avatar: false, username: false });
    setReason("");
    setError(null);
    onClose();
  }

  async function submit() {
    if (!user) return;
    const parsed = suspendReasonSchema.safeParse(reason);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid reason");
      return;
    }
    setBusy(true);
    try {
      await reset({ profileId: user.id as Id<"profiles">, ...fields, reason: parsed.data });
      toast("Profile reset", "success");
      close();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const options: { key: keyof typeof fields; label: string }[] = [
    { key: "bio", label: "Clear bio" },
    { key: "avatar", label: "Remove avatar" },
    { key: "username", label: "Replace handle with a random one" },
  ];

  return (
    <Modal
      open={user !== null}
      onClose={close}
      title={user ? `Reset @${user.username}'s profile` : undefined}
      description="For an offensive bio, avatar or handle. The user is emailed the reason and keeps their account."
    >
      <div className="mt-4 space-y-4">
        <fieldset className="space-y-2">
          {options.map((o) => (
            <label key={o.key} className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={fields[o.key]}
                onChange={(e) => setFields({ ...fields, [o.key]: e.target.checked })}
              />
              {o.label}
            </label>
          ))}
        </fieldset>
        <Textarea
          id="reset-reason"
          label="Reason (shown to the user)"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={error ?? undefined}
          maxLength={500}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={!fields.bio && !fields.avatar && !fields.username}
            onClick={submit}
          >
            Reset
          </Button>
        </div>
      </div>
    </Modal>
  );
}
