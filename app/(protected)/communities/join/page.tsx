"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
      <div className="py-16 text-center text-sm text-muted-foreground">
        Resolving invite...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-red-500">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => router.push("/communities")}
        >
          Back to communities
        </Button>
      </div>
    );
  }

  return (
    <div className="flex justify-center py-16">
      <Card className="max-w-sm w-full text-center space-y-4">
        <h2 className="text-lg font-bold">
          You&apos;re invited to join
        </h2>
        <p className="text-xl font-semibold">
          {invite?.communities?.name}
        </p>
        {invite?.communities?.description && (
          <p className="text-sm text-muted-foreground">
            {invite.communities.description}
          </p>
        )}
        <Button onClick={handleAccept} loading={accepting} className="w-full">
          Accept &amp; join
        </Button>
      </Card>
    </div>
  );
}
