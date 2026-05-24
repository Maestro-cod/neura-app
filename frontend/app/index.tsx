import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { colors } from "@/src/theme";

export default function Index() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center} testID="index-loading">
        <ActivityIndicator color={colors.gradientStart} />
      </View>
    );
  }
  if (!session) return <Redirect href="/auth/login" />;
  if (!profile?.onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/galaxy" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
});
