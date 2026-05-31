import "react-native-url-polyfill/auto.js";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider } from "@/src/context/AuthContext";
import { colors, applyThemePalette, type ThemeMode } from "@/src/theme";
import { loadThemeMode } from "@/src/lib/theme-mode";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [iconsLoaded, iconErr] = useIconFonts();
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  const [mode, setMode] = useState<ThemeMode>("dark");
  const [themeReady, setThemeReady] = useState(false);

  // Apply the saved theme before rendering any screen (covers native, where
  // theme.ts can't read storage synchronously).
  useEffect(() => {
    loadThemeMode().then((m) => {
      applyThemePalette(m);
      setMode(m);
      setThemeReady(true);
    });
  }, []);

  useEffect(() => {
    if ((iconsLoaded || iconErr) && fontsLoaded && themeReady) {
      SplashScreen.hideAsync();
    }
  }, [iconsLoaded, iconErr, fontsLoaded, themeReady]);

  if (!(iconsLoaded || iconErr) || !fontsLoaded || !themeReady) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style={mode === "light" ? "dark" : "light"} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
