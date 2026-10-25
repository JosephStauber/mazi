import { Resend } from "@convex-dev/resend";
import { components } from "./_generated/api";
import type { ActionCtx, MutationCtx } from "./_generated/server";

/**
 * Transactional auth email via Resend (durable queue + retries). Only the
 * auth flows send mail; nothing marketing-shaped goes through here.
 *
 * Env (set on the Convex deployment, never in the repo):
 *   RESEND_API_KEY  — without it, emails are logged to the Convex dashboard
 *                     logs instead of sent (local development fallback).
 *   RESEND_FROM     — e.g. "Mazi <hello@mazi.social>". Defaults to Resend's
 *                     shared test sender, which only delivers to your own address.
 */
export const resend = new Resend(components.resend, { testMode: false });

const FROM = () => process.env.RESEND_FROM || "Mazi <onboarding@resend.dev>";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(heading: string, body: string, cta: string, url: string) {
  const safeUrl = escapeHtml(url);
  return `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:Helvetica,Arial,sans-serif;color:#1a1714">
<div style="max-width:480px;margin:0 auto;padding:40px 24px">
<p style="font-family:Georgia,serif;font-size:28px;margin:0 0 24px">mazi<span style="color:#d9472b">.</span></p>
<h1 style="font-family:Georgia,serif;font-size:22px;font-weight:600;margin:0 0 12px">${heading}</h1>
<p style="font-size:15px;line-height:1.6;margin:0 0 24px">${body}</p>
<a href="${safeUrl}" style="display:inline-block;background:#1a1714;color:#f6f3ee;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:600">${cta}</a>
<p style="font-size:12px;line-height:1.6;color:#6b645c;margin:28px 0 0">If the button doesn't work, paste this link into your browser:<br>${safeUrl}</p>
<p style="font-size:12px;color:#6b645c;margin:16px 0 0">If you didn't request this, you can ignore this email.</p>
</div></body></html>`;
}

async function send(
  ctx: ActionCtx,
  { to, subject, html, url }: { to: string; subject: string; html: string; url: string }
) {
  if (!process.env.RESEND_API_KEY) {
    // Dev fallback: no key configured, so surface the link in the logs.
    console.log(`[email not sent: RESEND_API_KEY unset] to=${to} subject="${subject}" link=${url}`);
    return;
  }
  await resend.sendEmail(ctx, { from: FROM(), to, subject, html });
}

export async function sendEmailVerification(
  ctx: ActionCtx,
  { to, url }: { to: string; url: string }
) {
  await send(ctx, {
    to,
    url,
    subject: "Confirm your email for Mazi",
    html: layout(
      "Confirm your email",
      "Tap the button below to confirm this address and finish setting up your Mazi account.",
      "Confirm email",
      url
    ),
  });
}

export async function sendResetPassword(
  ctx: ActionCtx,
  { to, url }: { to: string; url: string }
) {
  await send(ctx, {
    to,
    url,
    subject: "Reset your Mazi password",
    html: layout(
      "Reset your password",
      "Someone (hopefully you) asked to reset the password for this Mazi account. The link expires in one hour.",
      "Choose a new password",
      url
    ),
  });
}

/**
 * Plain notice email (moderation decisions, the one-off launch announcement).
 * Text only: no images, no tracking pixels, no link rewriting. Works from a
 * mutation — Resend's queue sends it after the transaction commits.
 */
export async function sendNotice(
  ctx: MutationCtx,
  {
    to,
    subject,
    paragraphs,
    footer,
  }: { to: string; subject: string; paragraphs: string[]; footer?: string }
) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email not sent: RESEND_API_KEY unset] to=${to} subject="${subject}"\n${paragraphs.join("\n\n")}`);
    return;
  }
  const html = `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:Helvetica,Arial,sans-serif;color:#1a1714">
<div style="max-width:480px;margin:0 auto;padding:40px 24px">
<p style="font-family:Georgia,serif;font-size:28px;margin:0 0 24px">mazi<span style="color:#d9472b">.</span></p>
${paragraphs
  .map((p) => `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;white-space:pre-wrap">${escapeHtml(p)}</p>`)
  .join("\n")}
${footer ? `<p style="font-size:12px;color:#6b645c;margin:28px 0 0">${escapeHtml(footer)}</p>` : ""}
</div></body></html>`;
  const text = [...paragraphs, ...(footer ? [footer] : [])].join("\n\n");
  await resend.sendEmail(ctx, { from: FROM(), to, subject, html, text });
}
