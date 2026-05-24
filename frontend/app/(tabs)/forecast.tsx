import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { colors, fonts, spacing, urgencyColors } from "@/src/theme";
import { GlassCard } from "@/src/components/GlassCard";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { UpgradeModal } from "@/src/components/UpgradeModal";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/lib/api";

type Day = { date: string; score: number; level: "low" | "med" | "high" };

export default function Forecast() {
  const { user, profile } = useAuth();
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrade, setUpgrade] = useState(false);

  const isLocked = profile?.plan === "free";

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { forecast } = await api.forecast(user.id);
      setDays(forecast);
    } catch {
      setDays([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    if (!isLocked) load();
    else setLoading(false);
  }, [load, isLocked]));

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.h1}>Stress Forecast</Text>
        <Text style={styles.sub}>Next 30 days · predicted mental load</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }} testID="forecast-screen">
        <GlassCard strong style={{ marginBottom: spacing.lg }}>
          <View style={styles.legend}>
            <LegendDot color={urgencyColors.low} label="Calm" />
            <LegendDot color={urgencyColors.med} label="Tense" />
            <LegendDot color={urgencyColors.high} label="Heavy" />
          </View>
        </GlassCard>

        {loading ? (
          <ActivityIndicator color={colors.gradientStart} />
        ) : (
          <View style={styles.grid} testID="forecast-calendar-grid">
            {days.map((d) => {
              const c = urgencyColors[d.level];
              const dayNum = parseInt(d.date.slice(-2), 10);
              const monthNum = parseInt(d.date.slice(5, 7), 10);
              return (
                <View
                  key={d.date}
                  testID="forecast-day-cell"
                  style={[styles.cell, { borderColor: c + "66", backgroundColor: c + "1A" }]}
                >
                  <Text style={[styles.cellDay, { color: c }]}>{dayNum}</Text>
                  <Text style={styles.cellMonth}>{monthNum}</Text>
                </View>
              );
            })}
          </View>
        )}

        {isLocked && (
          <View style={styles.lockOverlay} pointerEvents="auto" testID="pro-upgrade-overlay">
            <GlassCard strong style={styles.lockCard}>
              <Ionicons name="lock-closed" size={32} color={colors.gradientStart} />
              <Text style={styles.lockTitle}>Forecast is a Pro feature</Text>
              <Text style={styles.lockSub}>
                See how your next 30 days look — color-coded by predicted mental load — to plan smarter and breathe easier.
              </Text>
              <PrimaryButton
                title="Upgrade to Pro · €9/mo"
                onPress={() => setUpgrade(true)}
                testID="pro-upgrade-button"
                style={{ marginTop: spacing.md }}
              />
            </GlassCard>
          </View>
        )}
      </ScrollView>
      <UpgradeModal visible={upgrade} onClose={() => setUpgrade(false)} reason="Unlock your 30-day stress forecast." />
    </SafeAreaView>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  h1: { color: colors.text, fontFamily: fonts.heading, fontSize: 26 },
  sub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  legend: { flexDirection: "row", justifyContent: "space-around" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.textDim, fontFamily: fonts.bodyMed, fontSize: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: {
    width: "13.5%",
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cellDay: { fontFamily: fonts.bodyBold, fontSize: 16 },
  cellMonth: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 9 },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,5,8,0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  lockCard: { alignItems: "center", gap: 6, maxWidth: 360 },
  lockTitle: { color: colors.text, fontFamily: fonts.heading, fontSize: 20, marginTop: 6, textAlign: "center" },
  lockSub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13, textAlign: "center", lineHeight: 19, marginTop: 4 },
});
