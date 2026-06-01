import Link from "next/link";
import { Fragment } from "react";
import { tokenizeMentions } from "@/lib/utils/mentions";
import { cn } from "@/lib/utils/cn";

interface RichTextProps {
  text: string;
  className?: string;
}

/** Renders post/comment text with @mentions as profile links. */
export function RichText({ text, className }: RichTextProps) {
  const tokens = tokenizeMentions(text);
  return (
    <p
      className={cn(
        "whitespace-pre-wrap break-words text-foreground",
        className
      )}
    >
      {tokens.map((t, i) =>
        t.type === "mention" ? (
          <Link
            key={i}
            href={`/profile/${t.username}`}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-accent transition-opacity hover:opacity-70"
          >
            @{t.username}
          </Link>
        ) : (
          <Fragment key={i}>{t.value}</Fragment>
        )
      )}
    </p>
  );
}
