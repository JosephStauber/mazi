"use client";

import Link from "next/link";
import { logout } from "@/lib/actions/auth";

export function ReservedHeader() {
  return (
    <header className="flex items-center justify-between px-5 py-4">
      <Link href="/welcome" className="brand text-2xl">
        mazi<span className="brand-dot">.</span>
      </Link>
      <button
        type="button"
        onClick={async () => {
          await logout();
          window.location.href = "/";
        }}
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Log out
      </button>
    </header>
  );
}
