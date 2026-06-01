"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Re-mounts + fades content on navigation for a smooth route change. */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-fade-up">
      {children}
    </div>
  );
}
