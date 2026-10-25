"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";

export function MarkAllReadButton() {
  const markAllRead = useMutation(api.notifications.markAllRead);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await markAllRead();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} loading={loading}>
      Mark all read
    </Button>
  );
}
