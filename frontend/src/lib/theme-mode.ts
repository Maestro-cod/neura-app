import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { THEME_STORAGE_KEY, type ThemeMode } from "@/src/theme";

/**
 * Persist and load the user's theme preference.
 *
 * Written to both localStorage (so theme.ts can read it synchronously on web
 * before styles evaluate) and AsyncStorage (so native can restore it on launch).
 */
export async function persistThemeMode(mode: ThemeMode): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // ignore — AsyncStorage write below still records the preference
    }
  }
  await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
}

export async function loadThemeMode(): Promise<ThemeMode> {
  const v = await AsyncStorage.getItem(THEME_STORAGE_KEY);
  return v === "light" ? "light" : "dark";
}
