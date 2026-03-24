"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createPost } from "@/lib/actions/post";

interface CommunityOption {
  community_id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  communities: any;
}

interface PostComposerProps {
  communities: CommunityOption[];
  fixedCommunityId?: string;
  /** After a successful post, navigate here (e.g. back to feed). */
  redirectOnSuccess?: string;
}

export function PostComposer({
  communities,
  fixedCommunityId,
  redirectOnSuccess,
}: PostComposerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  function removeImage() {
    setPreviewUrl(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await createPost(formData);
    if (result?.error) {
      setError(result.error);
    } else {
      formRef.current?.reset();
      setPreviewUrl(null);
      if (redirectOnSuccess) router.push(redirectOnSuccess);
      else router.refresh();
    }
    setLoading(false);
  }

  function getCommunityName(c: CommunityOption): string | null {
    if (!c.communities) return null;
    if (Array.isArray(c.communities)) return c.communities[0]?.name ?? null;
    return c.communities.name ?? null;
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="space-y-4 rounded-none border border-border bg-background p-4 md:rounded-lg"
    >
      <Textarea
        name="content"
        placeholder="Write a caption..."
        required
        maxLength={2000}
      />

      {previewUrl ? (
        <div className="relative inline-block max-w-full">
          {/* eslint-disable-next-line @next/next/no-img-element -- blob URL preview */}
          <img
            src={previewUrl}
            alt=""
            className="max-h-36 w-auto max-w-full rounded-md border border-border object-cover"
          />
          <button
            type="button"
            onClick={removeImage}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-sm backdrop-blur-sm hover:bg-muted"
            aria-label="Remove image"
          >
            <CloseIcon />
          </button>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        {fixedCommunityId ? (
          <input type="hidden" name="community_id" value={fixedCommunityId} />
        ) : (
          <select
            name="community_id"
            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            defaultValue=""
          >
            <option value="">Personal post</option>
            {communities.map((c) => {
              const name = getCommunityName(c);
              return name ? (
                <option key={c.community_id} value={c.community_id}>
                  {name}
                </option>
              ) : null;
            })}
          </select>
        )}

        <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-muted transition-colors">
          <ImageIcon />
          Image
          <input
            ref={imageInputRef}
            type="file"
            name="image"
            accept="image/*"
            className="hidden"
            onChange={onImageChange}
          />
        </label>

        <Button type="submit" size="sm" loading={loading} className="ml-auto">
          Share
        </Button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}

function ImageIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
