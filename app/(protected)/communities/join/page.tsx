"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { CommunitiesIcon } from "@/components/ui/icon";
import { resolveInviteToken, acceptInvite } from "@/lib/actions/community";

export default function JoinByTokenPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [invite, setInvite] = useState<any>(null);

  useEffect(() => {
    if (!token) {
      setError("No invite token provided");
      setLoading(false);
      return;
    }
    resolveInviteToken(token).then((result) => {
      if (result.error) setError(result.error);
      else setInvite(result.invite);
      setLoading(false);
    });
  }, [token]);

  async function handleAccept() {
    if (!invite) return;
    setAccepting(true);
    const result = await acceptInvite(invite.id);
    if (result?.error) {
      setError(result.error);
      setAccepting(false);
    } else {
      router.push(`/communities/${invite.communities?.slug || ""}`);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (error) {
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
            {invite?.communities?.name}
          </h2>
        </div>
        {invite?.communities?.description && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {invite.communities.description}
          </p>
        )}
        <Button onClick={handleAccept} loading={accepting} fullWidth>
          Accept &amp; join
        </Button>
      </Card>
    </div>
  );
}
