"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead } from "@/lib/actions/notification";

export function MarkAllReadButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    await markAllNotificationsRead();
    setLoading(false);
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} loading={loading}>
      Mark all read
    </Button>
  );
}
