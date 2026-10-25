"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { loginSchema } from "@/lib/validators/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SocialButtons } from "@/components/auth/social-buttons";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setUnverifiedEmail(null);
    const parsed = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await authClient.signIn.email(parsed.data);
    if (error) {
      setLoading(false);
      if (error.code === "EMAIL_NOT_VERIFIED") {
        setUnverifiedEmail(parsed.data.email);
        setError("Confirm your email first — check your inbox for the link.");
      } else {
        setError(authErrorMessage(error, "Invalid email or password"));
      }
      return;
    }
    // Full navigation so the server layouts see the new session cookie.
    window.location.href = "/home";
  }

  async function handlePasskey() {
    setError(null);
    setPasskeyLoading(true);
    const result = await authClient.signIn.passkey();
    if (result?.error) {
      setPasskeyLoading(false);
      setError(authErrorMessage(result.error, "Passkey sign-in was cancelled"));
      return;
    }
    window.location.href = "/home";
  }

  async function resendVerification() {
    if (!unverifiedEmail) return;
    await authClient.sendVerificationEmail({ email: unverifiedEmail, callbackURL: "/home" });
    setResent(true);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 text-center">
          <Link href="/" className="brand text-4xl">
            mazi<span className="brand-dot">.</span>
          </Link>
          <h1 className="brand mt-6 text-2xl text-foreground">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Log in to your account
          </p>
        </div>

        <div className="space-y-4">
          <SocialButtons callbackURL="/home" onError={setError} />

          <form action={handleSubmit} className="space-y-4">
            <Input
              id="email"
              name="email"
              type="email"
              label="Email"
              placeholder="you@example.com"
              required
              autoComplete="email webauthn"
            />
            <Input
              id="password"
              name="password"
              type="password"
              label="Password"
              placeholder="••••••••"
              required
              autoComplete="current-password webauthn"
            />
            <div className="-mt-1 text-right">
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Forgot password?
              </Link>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            {unverifiedEmail && (
              <button
                type="button"
                onClick={resendVerification}
                disabled={resent}
                className="text-sm font-medium text-foreground underline-offset-2 hover:underline disabled:opacity-60"
              >
                {resent ? "Confirmation email sent" : "Resend confirmation email"}
              </button>
            )}
            <Button type="submit" fullWidth size="lg" loading={loading}>
              Log in
            </Button>
          </form>

          <Button
            type="button"
            variant="outline"
            fullWidth
            size="lg"
            loading={passkeyLoading}
            onClick={handlePasskey}
          >
            Sign in with a passkey
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-foreground hover:underline">
            Sign up
          </Link>
        </p>
        <p className="mt-8 text-center text-xs text-subtle">
          <Link href="/legal/privacy" className="hover:text-foreground">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link href="/legal/terms" className="hover:text-foreground">
            Terms
          </Link>
        </p>
      </div>
    </div>
  );
}
