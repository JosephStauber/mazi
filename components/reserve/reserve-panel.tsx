"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { legal } from "@/lib/legal/config";
import { checkUsername } from "@/lib/actions/reserve";

type Status = "idle" | "invalid" | "checking" | "available" | "taken" | "error";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
const passwordOk = (p: string) =>
  p.length >= 8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p);

export type ReserveFields = {
  username: string;
  email: string;
  password: string;
  agreed: boolean;
};

export function ReservePanel({
  fields,
  onChange,
  onSubmit,
  loading,
  error,
}: {
  fields: ReserveFields;
  onChange: (patch: Partial<ReserveFields>) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
}) {
  // Only the async result is stored; idle/invalid/checking are derived at
  // render (keeps setState out of the effect body).
  const [result, setResult] = useState<{
    name: string;
    available: boolean;
    error?: boolean;
  } | null>(null);

  const { username, email, password, agreed } = fields;
  const name = username.trim();
  const validFormat = USERNAME_RE.test(name);

  // Debounced availability check; setState happens only in the async callback,
  // and always fires (even on failure) so the field never sticks on "Checking".
  useEffect(() => {
    if (!validFormat) return;
    let active = true;
    const t = setTimeout(async () => {
      try {
        const { available } = await checkUsername(name);
        if (active) setResult({ name, available });
      } catch {
        if (active) setResult({ name, available: false, error: true });
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [name, validFormat]);

  const status: Status =
    name.length === 0
      ? "idle"
      : !validFormat
        ? "invalid"
        : result?.name === name
          ? result.error
            ? "error"
            : result.available
              ? "available"
              : "taken"
          : "checking";

  const canSubmit =
    status === "available" &&
    /.+@.+\..+/.test(email) &&
    passwordOk(password) &&
    agreed &&
    !loading;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit();
      }}
      className="space-y-4 text-left"
    >
      <div>
        <Input
          id="reserve-username"
          label="Your username"
          placeholder="your_username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          onChange={(e) => onChange({ username: e.target.value })}
        />
        <UsernameStatus status={status} username={username.trim()} />
      </div>

      <Input
        id="reserve-email"
        type="email"
        label="Email"
        placeholder="you@example.com"
        autoComplete="email"
        hint="Where we'll reach you when Mazi opens."
        value={email}
        onChange={(e) => onChange({ email: e.target.value })}
      />

      <Input
        id="reserve-password"
        type="password"
        label="Password"
        placeholder="••••••••"
        autoComplete="new-password"
        minLength={8}
        hint="8+ characters, with an uppercase letter and a number."
        value={password}
        onChange={(e) => onChange({ password: e.target.value })}
      />

      <label className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => onChange({ agreed: e.target.checked })}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--accent)]"
        />
        <span className="leading-relaxed">
          I&rsquo;m at least {legal.minimumAge} years old and I agree to the{" "}
          <Link href="/legal/terms" className="font-medium text-accent hover:opacity-70">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="font-medium text-accent hover:opacity-70">
            Privacy Policy
          </Link>
          .
        </span>
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button
        type="submit"
        variant="accent"
        fullWidth
        size="lg"
        loading={loading}
        disabled={!canSubmit}
      >
        Reserve @{username.trim() || "username"}
      </Button>
    </form>
  );
}

function UsernameStatus({
  status,
  username,
}: {
  status: Status;
  username: string;
}) {
  if (status === "idle") return null;
  const map: Record<Exclude<Status, "idle">, { text: string; cls: string }> = {
    invalid: {
      text: "3–30 letters, numbers, or underscores.",
      cls: "text-muted-foreground",
    },
    checking: { text: "Checking availability…", cls: "text-muted-foreground" },
    available: { text: `@${username} is yours to claim.`, cls: "text-accent" },
    taken: { text: "That username is already reserved.", cls: "text-danger" },
    error: {
      text: "Couldn't check availability — try again.",
      cls: "text-muted-foreground",
    },
  };
  const { text, cls } = map[status];
  return <p className={`mt-1.5 text-sm font-medium ${cls}`}>{text}</p>;
}
