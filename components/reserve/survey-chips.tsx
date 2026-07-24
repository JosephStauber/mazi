"use client";

import { cn } from "@/lib/utils/cn";
import { SURVEY_OPTIONS } from "@/lib/reserve/config";

/** Multi-select "what bothers you about social media" chips. */
export function SurveyChips({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {SURVEY_OPTIONS.map((opt) => {
        const active = selected.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(opt.id)}
            className={cn(
              "group flex items-start gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-left transition-all duration-150 ease-spring active:scale-[0.98]",
              active
                ? "border-accent bg-accent-muted shadow-xs"
                : "border-border bg-surface hover:border-border-strong"
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                active
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border-strong text-transparent"
              )}
              aria-hidden
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3">
                <path
                  d="M5 10.5l3.2 3.2L15 6"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">
                {opt.label}
              </span>
              <span className="block text-xs text-muted-foreground">
                {opt.blurb}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
