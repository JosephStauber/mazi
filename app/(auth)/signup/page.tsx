"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { signupSchema } from "@/lib/validators/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SocialButtons } from "@/components/auth/social-buttons";
import { legal } from "@/lib/legal/config";

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    if (!agreed) {
      setError(
        "Please confirm your age and accept the Terms and Privacy Policy."
      );
      return;
    }
    const parsed = signupSchema.safeParse({
      email: formData.get("email"),
      username: formData.get("username"),
      password: formData.get("password"),
      agreed: agreed ? "on" : "",
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    setError(null);
    const { email, username, password } = parsed.data;
    const { error } = await authClient.signUp.email({
      email,
      password,
      // Better Auth requires a name; Mazi shows only the username.
      name: username,
      signupMeta: JSON.stringify({ username }),
      callbackURL: "/home",
    });
    setLoading(false);
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    // Email verification is required before the first sign-in.
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm animate-fade-up text-center">
          <Link href="/" className="brand text-4xl">
            mazi<span className="brand-dot">.</span>
          </Link>
          <h1 className="brand mt-6 text-2xl text-foreground">Check your inbox</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{sentTo}</span>. Open
            it to finish creating your account.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-sm font-semibold text-foreground hover:underline"
          >
            Back to log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 text-center">
          <Link href="/" className="brand text-4xl">
            mazi<span className="brand-dot">.</span>
          </Link>
          <h1 className="brand mt-6 text-2xl text-foreground">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            No algorithm, no ads — just people.
          </p>
        </div>

        <div className="space-y-4">
          <SocialButtons callbackURL="/home" onError={setError} />

          <form action={handleSubmit} className="space-y-4">
            <Input
              id="username"
              name="username"
              type="text"
              label="Username"
              placeholder="your_username"
              required
              autoComplete="username"
              hint="Letters, numbers, and underscores."
            />
            <Input
              id="email"
              name="email"
              type="email"
              label="Email"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            <Input
              id="password"
              name="password"
              type="password"
              label="Password"
              placeholder="••••••••"
              required
              minLength={8}
              autoComplete="new-password"
              hint="8+ characters, with an uppercase letter and a number."
            />
            <label className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
              <input
                type="checkbox"
                name="agreed"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--accent)]"
              />
              <span className="leading-relaxed">
                I&rsquo;m at least {legal.minimumAge} years old and I agree to the{" "}
                <Link
                  href="/legal/terms"
                  className="font-medium text-accent hover:opacity-70"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/legal/privacy"
                  className="font-medium text-accent hover:opacity-70"
                >
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={loading}
              disabled={!agreed}
            >
              Create account
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-foreground hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
