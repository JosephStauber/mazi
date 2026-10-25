"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { authClient, authErrorMessage } from "@/lib/auth-client";

/**
 * Google / Apple sign-in. Renders nothing until the provider credentials are
 * configured on the Convex deployment (see docs/SETUP.md) — the server reports
 * which providers are live via `auth:providers`.
 */
export function SocialButtons({
  callbackURL,
  onError,
}: {
  callbackURL: string;
  onError: (message: string) => void;
}) {
  const providers = useQuery(api.auth.providers);
  const [pending, setPending] = useState<"google" | "apple" | null>(null);

  if (!providers || (!providers.google && !providers.apple)) return null;

  async function go(provider: "google" | "apple") {
    setPending(provider);
    const { error } = await authClient.signIn.social({ provider, callbackURL });
    // On success the browser is redirected to the provider.
    if (error) {
      setPending(null);
      onError(authErrorMessage(error));
    }
  }

  return (
    <div className="space-y-2.5">
      {providers.google && (
        <Button
          type="button"
          variant="outline"
          fullWidth
          size="lg"
          loading={pending === "google"}
          onClick={() => go("google")}
        >
          Continue with Google
        </Button>
      )}
      {providers.apple && (
        <Button
          type="button"
          variant="outline"
          fullWidth
          size="lg"
          loading={pending === "apple"}
          onClick={() => go("apple")}
        >
          Continue with Apple
        </Button>
      )}
      <div className="flex items-center gap-3 py-1 text-xs text-subtle">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
