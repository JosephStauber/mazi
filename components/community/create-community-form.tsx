"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createCommunity } from "@/lib/actions/community";

export function CreateCommunityForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await createCommunity(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Create community
      </Button>
    );
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-3 rounded-lg border border-border p-4"
    >
      <h3 className="text-sm font-semibold">New community</h3>
      <Input name="name" placeholder="Community name" required />
      <Textarea
        name="description"
        placeholder="What's this community about?"
        maxLength={300}
      />
      <select
        name="privacy_type"
        className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        defaultValue="public"
      >
        <option value="public">Public</option>
        <option value="invite_only">Invite only</option>
      </select>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={loading}>
          Create
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
