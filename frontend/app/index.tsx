import { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { colors } from "@/src/theme";

export default function Index() {
  const { session, profile, loading } = useAuth();
  const pulse = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.8, duration: 800, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [loading, pulse]);

  if (loading) {
    return (
      <View style={styles.center} testID="index-loading">
        <Animated.View style={[styles.skeleton, { opacity: pulse, width: 120, height: 120, borderRadius: 60 }]} />
        <Animated.View style={[styles.skeleton, { opacity: pulse, width: 160, height: 16, borderRadius: 8, marginTop: 20 }]} />
        <Animated.View style={[styles.skeleton, { opacity: pulse, width: 100, height: 12, borderRadius: 6, marginTop: 10 }]} />
      </View>
    );
  }
  if (!session) return <Redirect href="/auth/login" />;
  if (!profile?.onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/galaxy" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  skeleton: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
});
