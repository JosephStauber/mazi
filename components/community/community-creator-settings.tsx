"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deleteCommunity, updateCommunity } from "@/lib/actions/community";

interface CommunityCreatorSettingsProps {
  community: {
    id: string;
    name: string;
    description: string | null;
    privacy_type: "public" | "invite_only";
  };
}

export function CommunityCreatorSettings({
  community,
}: CommunityCreatorSettingsProps) {
  const router = useRouter();
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  async function handleEditSubmit(formData: FormData) {
    setEditLoading(true);
    setFormError(null);
    formData.set("community_id", community.id);
    const result = await updateCommunity(formData);
    if (result?.error) {
      setFormError(result.error);
    } else {
      setEditing(false);
      router.refresh();
    }
    setEditLoading(false);
  }

  function openDeleteDialog() {
    setDialogError(null);
    deleteDialogRef.current?.showModal();
  }

  function closeDeleteDialog() {
    deleteDialogRef.current?.close();
  }

  async function handleConfirmDelete() {
    setDeleteLoading(true);
    setDialogError(null);
    const result = await deleteCommunity(community.id);
    if (result?.error) {
      setDialogError(result.error);
      setDeleteLoading(false);
      return;
    }
    closeDeleteDialog();
    router.push("/communities");
    router.refresh();
    setDeleteLoading(false);
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
        Creator
      </p>

      {!editing ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setFormError(null);
              setEditing(true);
            }}
          >
            Edit community
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={openDeleteDialog}
          >
            Delete community
          </Button>
        </div>
      ) : (
        <form action={handleEditSubmit} className="space-y-3">
          <input type="hidden" name="community_id" value={community.id} />
          <Input
            id="edit-community-name"
            name="name"
            label="Name"
            defaultValue={community.name}
            required
            maxLength={50}
          />
          <Textarea
            id="edit-community-description"
            name="description"
            label="Description"
            defaultValue={community.description ?? ""}
            maxLength={300}
            placeholder="What is this community about?"
          />
          <div>
            <label
              htmlFor="edit-privacy"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Privacy
            </label>
            <select
              id="edit-privacy"
              name="privacy_type"
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              defaultValue={community.privacy_type}
            >
              <option value="public">Public</option>
              <option value="invite_only">Invite only</option>
            </select>
          </div>
          {formError && (
            <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" loading={editLoading}>
              Save changes
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setFormError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      <dialog
        ref={deleteDialogRef}
        className="fixed left-1/2 top-1/2 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-6 shadow-lg backdrop:bg-black/50"
        onClose={() => setDialogError(null)}
      >
        <h2 className="text-lg font-semibold text-foreground">
          Delete this community?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          This cannot be undone.{" "}
          <span className="font-medium text-foreground">{community.name}</span>{" "}
          and all of its posts, members, and invites will be permanently
          removed.
        </p>
        {dialogError && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            {dialogError}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="sm:min-w-24"
            onClick={closeDeleteDialog}
            disabled={deleteLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            className="sm:min-w-32"
            loading={deleteLoading}
            onClick={handleConfirmDelete}
          >
            Delete community
          </Button>
        </div>
      </dialog>
    </div>
  );
}
