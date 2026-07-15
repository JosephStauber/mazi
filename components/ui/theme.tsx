"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  ReactNode,
} from "react";
import { cn } from "@/lib/utils/cn";
import { SunIcon, MoonIcon } from "@/components/ui/icon";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/** Runs before paint to avoid a flash of the wrong theme. */
export const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

function subscribeTheme(cb: () => void) {
  window.addEventListener("theme-change", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("theme-change", cb);
    window.removeEventListener("storage", cb);
  };
}

function getStoredTheme(): Theme {
  try {
    return (localStorage.getItem("theme") as Theme) || "system";
  } catch {
    return "system";
  }
}

function subscribeSystem(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Both theme (localStorage) and the system preference are external stores;
  // reading them via useSyncExternalStore keeps initialization out of an effect
  // (no react-hooks/set-state-in-effect) and derives `resolved` instead of
  // storing it. The effect only writes the DOM class.
  const theme = useSyncExternalStore<Theme>(
    subscribeTheme,
    getStoredTheme,
    () => "system"
  );
  const systemDark = useSyncExternalStore(
    subscribeSystem,
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false
  );
  const resolved: "light" | "dark" =
    theme === "dark" || (theme === "system" && systemDark) ? "dark" : "light";

  // The pre-paint `themeScript` already set the correct initial class, so skip
  // the first commit (which may still hold the server snapshot) to avoid a flash;
  // apply on every later change.
  const firstApply = useRef(true);
  useEffect(() => {
    if (firstApply.current) {
      firstApply.current = false;
      return;
    }
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  const setTheme = useCallback((t: Theme) => {
    try {
      localStorage.setItem("theme", t);
    } catch {
      /* private mode */
    }
    window.dispatchEvent(new Event("theme-change"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, setTheme } = useTheme();
  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-all duration-150 ease-spring hover:bg-muted active:scale-90",
        className
      )}
    >
      {resolved === "dark" ? <MoonIcon size={20} /> : <SunIcon size={20} />}
    </button>
  );
}
