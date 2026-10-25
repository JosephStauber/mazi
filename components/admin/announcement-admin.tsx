"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/utils/errors";
import { announcementSchema } from "@/lib/validators/admin";

export function AnnouncementAdmin() {
  const status = useQuery(api.adminAnnouncements.status);
  const sendTest = useMutation(api.adminAnnouncements.sendTest);
  const sendLaunch = useMutation(api.adminAnnouncements.sendLaunch);
  const { toast } = useToast();
  const [subject, setSubject] = useState("Mazi is open");
  const [body, setBody] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<"test" | "send" | null>(null);

  function parsed() {
    const r = announcementSchema.safeParse({ subject, body });
    if (!r.success) toast(r.error.issues[0]?.message ?? "Invalid message", "error");
    return r.success ? r.data : null;
  }

  async function test() {
    const msg = parsed();
    if (!msg) return;
    setBusy("test");
    try {
      await sendTest(msg);
      toast(`Test sent to ${status?.my_email}`, "success");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    const msg = parsed();
    if (!msg) return;
    setBusy("send");
    try {
      await sendLaunch(msg);
      toast("Sending — this page updates as it goes", "success");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(null);
    }
  }

  if (status === undefined) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="brand text-3xl text-foreground">Launch announcement</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One plain-text email to everyone who reserved (verified addresses only) —
          no images, no tracking, and it can be sent exactly once.{" "}
          {status.reserved} reservations.
        </p>
      </header>

      {status.launch ? (
        <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 text-sm">
          <p className="font-medium text-foreground">
            {status.launch.status === "sent" ? "Sent" : "Sending…"} “{status.launch.subject}”
          </p>
          <p className="mt-1 text-muted-foreground">
            {status.launch.recipients} delivered to the queue · started{" "}
            {new Date(status.launch.created_at).toLocaleString()}
          </p>
        </section>
      ) : (
        <section className="space-y-4 rounded-[var(--radius-lg)] border border-border bg-surface p-4">
          <Input
            id="announce-subject"
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={120}
          />
          <Textarea
            id="announce-body"
            label="Message (blank line between paragraphs)"
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <Button variant="outline" size="sm" loading={busy === "test"} disabled={!!busy || !status.my_email} onClick={test}>
              Send test to {status.my_email ?? "me"}
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="announce-confirm"
                placeholder="Type SEND"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="off"
              />
              <Button
                variant="accent"
                size="sm"
                loading={busy === "send"}
                disabled={!!busy || confirm !== "SEND"}
                onClick={send}
              >
                Send to everyone
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
