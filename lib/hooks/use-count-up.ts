import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

/** Subscribe to the reduced-motion preference without setState-in-effect. */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(REDUCE_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCE_QUERY).matches,
    () => false
  );
}

/**
 * Animate a number toward `target` with requestAnimationFrame. Re-eases from
 * wherever it currently is whenever `target` changes (so dragging a slider
 * feels continuous). Snaps instantly when the user prefers reduced motion.
 */
export function useCountUp(target: number, durationMs = 650): number {
  const reduce = usePrefersReducedMotion();
  const [value, setValue] = useState(target);
  const frame = useRef<number | null>(null);
  const fromRef = useRef(target);

  useEffect(() => {
    if (reduce) return;

    const from = fromRef.current;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      const current = from + (target - from) * easeOutCubic(t);
      setValue(current);
      fromRef.current = current;
      if (t < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [target, durationMs, reduce]);

  return reduce ? target : value;
}
