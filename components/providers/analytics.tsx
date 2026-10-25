"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

// Path segments that identify a person or piece of content. They're replaced
// with the route placeholder so pageviews are counted per page type, never
// per user or post.
const DYNAMIC_ROUTES: [RegExp, string][] = [
  [/^\/profile\/[^/]+/, "/profile/[username]"],
  [/^\/communities\/(?!join(?:\/|$))[^/]+/, "/communities/[slug]"],
  [/^\/post\/[^/]+/, "/post/[id]"],
];

// Cookieless, aggregate Vercel Web Analytics (see docs/DECISIONS.md D15).
// Query strings and hashes are dropped: they can carry password-reset and
// invite tokens, search terms, and referral codes.
function redact(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url);
  let path = url.pathname;
  for (const [pattern, placeholder] of DYNAMIC_ROUTES) {
    path = path.replace(pattern, placeholder);
  }
  return { ...event, url: `${url.origin}${path}` };
}

export function PrivateAnalytics() {
  return <Analytics beforeSend={redact} />;
}
