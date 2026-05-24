import "react-native-url-polyfill/auto.js";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts as useSyne, Syne_600SemiBold, Syne_700Bold, Syne_800ExtraBold } from "@expo-google-fonts/syne";
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from "@expo-google-fonts/dm-sans";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider } from "@/src/context/AuthContext";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [iconsLoaded, iconErr] = useIconFonts();
  const [fontsLoaded] = useSyne({
    Syne_600SemiBold,
    Syne_700Bold,
    Syne_800ExtraBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  useEffect(() => {
    if ((iconsLoaded || iconErr) && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [iconsLoaded, iconErr, fontsLoaded]);

  if (!(iconsLoaded || iconErr) || !fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#050508" } }} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
