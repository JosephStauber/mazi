"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(formData: FormData) {
    const email = String(formData.get("email") ?? "").trim();
    if (!email) return;
    setLoading(true);
    // Same response whether or not the address has an account (no enumeration).
    await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 text-center">
          <Link href="/" className="brand text-4xl">
            mazi<span className="brand-dot">.</span>
          </Link>
          <h1 className="brand mt-6 text-2xl text-foreground">Reset your password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sent
              ? "If that address has a Mazi account, a reset link is on its way."
              : "We'll email you a link to choose a new one."}
          </p>
        </div>

        {!sent && (
          <form action={handleSubmit} className="space-y-4">
            <Input
              id="email"
              name="email"
              type="email"
              label="Email"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            <Button type="submit" fullWidth size="lg" loading={loading}>
              Send reset link
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-semibold text-foreground hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
