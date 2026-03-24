/**
 * Turns PostgREST / Supabase client errors into actionable copy when the
 * remote project is missing migrations or API exposure.
 */
export function mapSupabaseUserMessage(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("schema cache") ||
    m.includes("could not find the table") ||
    (m.includes("relation") && m.includes("does not exist"))
  ) {
    return "Database tables are missing (e.g. communities, posts). In the Supabase dashboard, open SQL Editor and run the full script in supabase/migrations/00001_schema.sql on your project, then try again.";
  }
  return message;
}
