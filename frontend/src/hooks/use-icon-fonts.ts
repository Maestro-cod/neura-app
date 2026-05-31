// Expo SDK 49+ bundles @expo/vector-icons fonts automatically in all
// environments (native, Expo Go, web). CDN loading is no longer needed
// and causes the splash screen to hang indefinitely if the CDN is slow.
// Usage: const [loaded, error] = useIconFonts();

import { useFonts } from "expo-font";

export const useIconFonts = (): readonly [boolean, Error | null] =>
  useFonts({});
