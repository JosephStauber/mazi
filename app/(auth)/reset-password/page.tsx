"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { passwordSchema } from "@/lib/validators/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const linkError = params.get("error");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(formData: FormData) {
    const password = String(formData.get("password") ?? "");
    if (password !== String(formData.get("confirm") ?? "")) {
      setError("Passwords don't match");
      return;
    }
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (!token) return;
    setLoading(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setLoading(false);
    if (error) {
      setError(authErrorMessage(error, "This reset link is invalid or has expired."));
      return;
    }
    setDone(true);
  }

  if (!token || linkError) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        This reset link is invalid or has expired.{" "}
        <Link href="/forgot-password" className="font-semibold text-foreground hover:underline">
          Request a new one
        </Link>
        .
      </p>
    );
  }

  if (done) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Your password has been updated.{" "}
        <Link href="/login" className="font-semibold text-foreground hover:underline">
          Log in
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <Input
        id="password"
        name="password"
        type="password"
        label="New password"
        placeholder="••••••••"
        required
        minLength={8}
        autoComplete="new-password"
        hint="8+ characters, with an uppercase letter and a number."
      />
      <Input
        id="confirm"
        name="confirm"
        type="password"
        label="Confirm new password"
        placeholder="••••••••"
        required
        autoComplete="new-password"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" fullWidth size="lg" loading={loading}>
        Update password
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 text-center">
          <Link href="/" className="brand text-4xl">
            mazi<span className="brand-dot">.</span>
          </Link>
          <h1 className="brand mt-6 text-2xl text-foreground">Choose a new password</h1>
        </div>
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
