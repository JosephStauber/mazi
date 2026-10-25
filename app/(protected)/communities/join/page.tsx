"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { CommunitiesIcon } from "@/components/ui/icon";
import { errorMessage } from "@/lib/utils/errors";

function JoinByToken() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const invite = useQuery(api.communities.inviteByToken, token ? { token } : "skip");
  const acceptInvite = useMutation(api.communities.acceptInvite);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const error =
    acceptError ??
    (!token
      ? "No invite token provided"
      : invite === null
        ? "Invite not found or already used"
        : null);

  async function handleAccept() {
    if (!invite) return;
    setAccepting(true);
    try {
      const { slug } = await acceptInvite({ inviteId: invite.id });
      router.push(`/communities/${slug}`);
    } catch (e) {
      setAcceptError(errorMessage(e));
      setAccepting(false);
    }
  }

  if (token && invite === undefined) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="px-6 py-20 text-center">
        <h2 className="text-base font-semibold text-foreground">
          Invite unavailable
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-5"
          onClick={() => router.push("/communities")}
        >
          Back to communities
        </Button>
      </div>
    );
  }

  return (
    <div className="flex justify-center px-4 py-16">
      <Card className="w-full max-w-sm space-y-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--radius-lg)] bg-foreground text-background">
          <CommunitiesIcon size={30} />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-subtle">
            You&apos;re invited to join
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground">
            {invite.community.name}
          </h2>
        </div>
        {invite.community.description && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {invite.community.description}
          </p>
        )}
        <Button onClick={handleAccept} loading={accepting} fullWidth>
          Accept &amp; join
        </Button>
      </Card>
    </div>
  );
}

export default function JoinByTokenPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      }
    >
      <JoinByToken />
    </Suspense>
  );
}
