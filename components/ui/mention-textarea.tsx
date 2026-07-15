"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Avatar } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import type { ProfileRef } from "@/lib/types/database";

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onInput?: () => void;
  placeholder?: string;
  name?: string;
  rows?: number;
  maxLength?: number;
  autoFocus?: boolean;
  className?: string;
}

// Matches the in-progress "@token" immediately before the caret.
const ACTIVE = /(?:^|[^a-zA-Z0-9_@])@([a-zA-Z0-9_]{0,30})$/;

export const MentionTextarea = forwardRef<
  HTMLTextAreaElement,
  MentionTextareaProps
>(function MentionTextarea(
  { value, onChange, onKeyDown, onInput, placeholder, name, rows, maxLength, autoFocus, className },
  forwardedRef
) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(forwardedRef, () => innerRef.current!, []);

  const [results, setResults] = useState<ProfileRef[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const queryRef = useRef<{ start: number; end: number } | null>(null);
  const reqId = useRef(0);
  const pendingCaret = useRef<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearDebounce() {
    if (debounceRef.current != null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }

  // Restore caret after a programmatic value change (mention insertion).
  useEffect(() => {
    if (pendingCaret.current != null && innerRef.current) {
      const pos = pendingCaret.current;
      innerRef.current.setSelectionRange(pos, pos);
      pendingCaret.current = null;
    }
  }, [value]);

  // Cancel any pending profile query when the field unmounts.
  useEffect(() => clearDebounce, []);

  function detectMention(text: string, caret: number) {
    const before = text.slice(0, caret);
    const m = before.match(ACTIVE);
    if (!m) {
      queryRef.current = null;
      clearDebounce();
      setOpen(false);
      return;
    }
    const query = m[1];
    queryRef.current = { start: caret - query.length - 1, end: caret };

    // Only one query in flight: cancel the previous keystroke's pending timer so
    // fast typing dispatches a single search, not one per character.
    clearDebounce();
    const id = ++reqId.current;
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient();
      let q = supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .limit(6);
      q = query ? q.ilike("username", `${query}%`) : q.order("username");
      const { data } = await q;
      if (id !== reqId.current) return;
      setResults(data ?? []);
      setActive(0);
      setOpen((data ?? []).length > 0);
    }, 140);
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    onChange(next);
    detectMention(next, e.target.selectionStart ?? next.length);
  }

  function select(user: ProfileRef) {
    const range = queryRef.current;
    if (!range) return;
    const before = value.slice(0, range.start);
    const after = value.slice(range.end);
    const inserted = `@${user.username} `;
    const next = before + inserted + after;
    pendingCaret.current = before.length + inserted.length;
    onChange(next);
    setOpen(false);
    queryRef.current = null;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (open && results.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (a + 1) % results.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a - 1 + results.length) % results.length);
        return;
      }
      if ((e.key === "Enter" && !e.metaKey && !e.ctrlKey) || e.key === "Tab") {
        e.preventDefault();
        select(results[active]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
    }
    onKeyDown?.(e);
  }

  return (
    <div className="relative">
      <textarea
        ref={innerRef}
        name={name}
        value={value}
        rows={rows}
        maxLength={maxLength}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={handleChange}
        onInput={onInput}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className={className}
      />

      {open && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-40 mt-1 w-full max-w-xs origin-top animate-scale-in overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface py-1 shadow-lg"
        >
          {results.map((user, i) => (
            <li key={user.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(user);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
                  i === active ? "bg-muted" : "hover:bg-muted/60"
                )}
              >
                <Avatar src={user.avatar_url} alt={user.username} size="xs" />
                <span className="truncate text-sm font-medium text-foreground">
                  {user.username}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
