import { useSegments } from "expo-router";

/**
 * When 3Sekawan is mounted under /three-sekawan-app in the main app, returns '/three-sekawan-app'.
 * When run standalone, returns ''.
 * Use for router.push/replace so navigation stays under the same app.
 */
export function useBasePath(): string {
  const segments = useSegments();
  return segments[0] === "three-sekawan-app" ? "/three-sekawan-app" : "";
}
