// Usernames are [a-zA-Z0-9_], 3–30 chars (see ensureProfileForAuthUser).
// A mention is "@username" not immediately preceded by a word char, so we
// don't pick "@handle" out of emails like "foo@bar".
const MENTION = /(^|[^a-zA-Z0-9_@])@([a-zA-Z0-9_]{1,30})/g;

/** Unique usernames referenced via @mention, in first-seen order. */
export function extractMentions(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of text.matchAll(MENTION)) {
    const username = m[2];
    if (!seen.has(username)) {
      seen.add(username);
      out.push(username);
    }
  }
  return out;
}

export type TextToken =
  | { type: "text"; value: string }
  | { type: "mention"; username: string };

/** Split text into plain segments and @mention tokens for rendering. */
export function tokenizeMentions(text: string): TextToken[] {
  const tokens: TextToken[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION)) {
    const lead = m[1]; // boundary char (may be empty)
    const username = m[2];
    const start = m.index ?? 0;
    const at = start + lead.length;
    if (at > last) tokens.push({ type: "text", value: text.slice(last, at) });
    tokens.push({ type: "mention", username });
    last = at + username.length + 1; // +1 for "@"
  }
  if (last < text.length) tokens.push({ type: "text", value: text.slice(last) });
  return tokens;
}
