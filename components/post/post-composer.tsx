"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { MentionTextarea } from "@/components/ui/mention-textarea";
import { useToast } from "@/components/ui/toast";
import { ImageIcon, CloseIcon } from "@/components/ui/icon";
import { createPost } from "@/lib/actions/post";
import { cn } from "@/lib/utils/cn";

const MAX = 2000;

interface CommunityOption {
  community_id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  communities: any;
}

interface PostComposerProps {
  communities: CommunityOption[];
  fixedCommunityId?: string;
  redirectOnSuccess?: string;
  author?: { username: string; avatar_url: string | null };
  autoFocus?: boolean;
}

export function PostComposer({
  communities,
  fixedCommunityId,
  redirectOnSuccess,
  author,
  autoFocus,
}: PostComposerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function autoGrow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 360)}px`;
  }

  function setFile(file: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast("Please choose an image file", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast("Image must be under 5MB", "error");
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
  }

  function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
  }

  function removeImage() {
    setPreviewUrl(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && imageInputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      imageInputRef.current.files = dt.files;
      setFile(file);
    }
  }

  async function handleSubmit(formData: FormData) {
    // The server requires non-empty text (createPostSchema), so an image-only
    // post would fail after upload — gate on text to match that contract.
    if (!value.trim()) {
      toast("Write something to post", "error");
      return;
    }
    setLoading(true);
    const result = await createPost(formData);
    if (result?.error) {
      toast(result.error, "error");
      setLoading(false);
      return;
    }
    formRef.current?.reset();
    setValue("");
    removeImage();
    setLoading(false);
    toast("Posted", "success");
    if (redirectOnSuccess) router.push(redirectOnSuccess);
    else router.refresh();
  }

  function getCommunityName(c: CommunityOption): string | null {
    if (!c.communities) return null;
    if (Array.isArray(c.communities)) return c.communities[0]?.name ?? null;
    return c.communities.name ?? null;
  }

  const remaining = MAX - value.length;

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "rounded-[var(--radius-lg)] border bg-surface p-4 transition-colors",
        dragging ? "border-foreground bg-muted" : "border-border"
      )}
    >
      <div className="flex gap-3">
        {author && (
          <Avatar
            src={author.avatar_url}
            alt={author.username}
            size="sm"
            className="mt-1 hidden sm:block"
          />
        )}
        <div className="min-w-0 flex-1">
          <MentionTextarea
            ref={textareaRef}
            name="content"
            value={value}
            autoFocus={autoFocus}
            onChange={(v) => {
              setValue(v.slice(0, MAX));
              autoGrow();
            }}
            onInput={autoGrow}
            placeholder="What's on your mind? Use @ to mention someone"
            className="min-h-[72px] w-full resize-none bg-transparent text-[16px] leading-relaxed text-foreground placeholder:text-subtle focus:outline-none"
            maxLength={MAX}
          />

          {previewUrl && (
            <div className="relative mt-2 inline-block w-full overflow-hidden rounded-[var(--radius-md)] border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img
                src={previewUrl}
                alt="Preview"
                className="max-h-80 w-full object-cover"
              />
              <button
                type="button"
                onClick={removeImage}
                aria-label="Remove image"
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-transform hover:scale-105 active:scale-95"
              >
                <CloseIcon size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
        <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <ImageIcon size={20} />
          <span className="hidden sm:inline">Photo</span>
          <input
            ref={imageInputRef}
            type="file"
            name="image"
            accept="image/*"
            className="hidden"
            onChange={onImageChange}
          />
        </label>

        {fixedCommunityId ? (
          <input type="hidden" name="community_id" value={fixedCommunityId} />
        ) : (
          communities.length > 0 && (
            <select
              name="community_id"
              aria-label="Post to community"
              defaultValue=""
              className="h-9 rounded-full border border-border bg-surface px-3 text-sm text-foreground focus:border-foreground focus:outline-none"
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
          )
        )}

        <div className="ml-auto flex items-center gap-3">
          {value.length > 0 && (
            <span
              className={cn(
                "text-xs tabular-nums",
                remaining < 0
                  ? "text-danger"
                  : remaining < 100
                    ? "text-muted-foreground"
                    : "text-subtle"
              )}
            >
              {remaining}
            </span>
          )}
          <Button type="submit" size="sm" loading={loading}>
            Share
          </Button>
        </div>
      </div>
    </form>
  );
}
