import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * The current window origin — `""` during SSR/hydration, the real value on the
 * client. Uses useSyncExternalStore so there's no setState-in-effect and no
 * hydration mismatch.
 */
export function useOrigin(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => ""
  );
}
