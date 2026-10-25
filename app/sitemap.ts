import type { MetadataRoute } from "next";
import { isReservationMode } from "@/lib/reserve/config";
import { LEGAL_PATHS, SITE_URL } from "@/lib/site";

// Only public pages: everything else needs an account, and profiles/posts are
// private by design, so they stay out of search.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    {
      url: `${SITE_URL}${isReservationMode() ? "/reserve" : "/signup"}`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...LEGAL_PATHS.map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
