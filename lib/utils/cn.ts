type ClassValue = string | number | null | false | undefined;

/** Tiny classnames joiner — no deps. Later args win by source order. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
