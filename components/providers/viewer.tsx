"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Profile } from "@/lib/types/database";

const ViewerContext = createContext<Profile | null>(null);

/**
 * The signed-in user's profile for client components. Seeded with the
 * server-fetched profile (no loading flash), then kept live — an avatar or
 * username change shows up everywhere at once.
 */
export function ViewerProvider({
  initialViewer,
  children,
}: {
  initialViewer: Profile;
  children: ReactNode;
}) {
  const live = useQuery(api.profiles.me);
  return (
    <ViewerContext.Provider value={live ?? initialViewer}>
      {children}
    </ViewerContext.Provider>
  );
}

export function useViewer(): Profile {
  const viewer = useContext(ViewerContext);
  if (!viewer) throw new Error("useViewer must be used inside ViewerProvider");
  return viewer;
}
