"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { PlusIcon } from "@/components/ui/icon";
import { errorMessage } from "@/lib/utils/errors";

export function CreateCommunityForm() {
  const { toast } = useToast();
  const router = useRouter();
  const createCommunity = useMutation(api.communities.create);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      const { slug } = await createCommunity({
        name: (formData.get("name") as string) ?? "",
        description: (formData.get("description") as string) || undefined,
        privacyType: formData.get("privacy_type") === "invite_only" ? "invite_only" : "public",
      });
      setOpen(false);
      router.push(`/communities/${slug}`);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button size="sm" leftIcon={<PlusIcon size={16} />} onClick={() => setOpen(true)}>
        Create
      </Button>

      <Modal
        open={open}
        onClose={() => !loading && setOpen(false)}
        title="New community"
        description="Start a space for people to gather around a shared interest."
      >
        <form action={handleSubmit} className="mt-4 space-y-3">
          <Input
            name="name"
            aria-label="Community name"
            placeholder="Community name"
            maxLength={50}
            required
            autoFocus
          />
          <Textarea
            name="description"
            aria-label="Community description"
            placeholder="What's this community about?"
            maxLength={300}
            rows={3}
          />
          <div>
            <label
              htmlFor="privacy_type"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Privacy
            </label>
            <select
              id="privacy_type"
              name="privacy_type"
              defaultValue="public"
              className="h-10 w-full rounded-[var(--radius-md)] border border-border bg-background px-3 text-sm text-foreground focus:border-foreground focus:outline-none focus:ring-4 focus:ring-foreground/5"
            >
              <option value="public">Public — anyone can join</option>
              <option value="invite_only">Invite only — join by invite</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={loading}>
              Create community
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
