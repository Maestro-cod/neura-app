import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { colors, fonts, spacing, zoneColors, zoneIcons } from "@/src/theme";
import { GlassCard } from "@/src/components/GlassCard";
import { GalaxyCanvas } from "@/src/components/GalaxyCanvas";
import { StressBadge } from "@/src/components/StressBadge";
import { useAuth } from "@/src/context/AuthContext";
import { supabase } from "@/src/lib/supabase";
import { api } from "@/src/lib/api";

type Zone = { id: string; name: string; color: string };
type Task = { id: string; title: string; urgency: "low" | "med" | "high"; zone_id: string | null; completed: boolean };

export default function Galaxy() {
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [zones, setZones] = useState<Zone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [insight, setInsight] = useState<string>("");
  const [loadingInsight, setLoadingInsight] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: z }, { data: t }] = await Promise.all([
      supabase.from("zones").select("*").eq("user_id", user.id).eq("active", true),
      supabase.from("tasks").select("*").eq("user_id", user.id).eq("completed", false),
    ]);
    setZones((z as any) || []);
    setTasks((t as any) || []);
  }, [user]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  useEffect(() => {
    if (!user) return;
    setLoadingInsight(true);
    api
      .aiInsight(user.id)
      .then((r) => setInsight(r.insight))
      .catch(() => setInsight("Take a deep breath. Tap a zone to begin."))
      .finally(() => setLoadingInsight(false));
  }, [user, tasks.length]);

  const stress = useMemo<"low" | "med" | "high">(() => {
    if (!tasks.length) return "low";
    const high = tasks.filter((t) => t.urgency === "high").length;
    const med = tasks.filter((t) => t.urgency === "med").length;
    if (high >= 3 || tasks.length >= 12) return "high";
    if (high >= 1 || med >= 3) return "med";
    return "low";
  }, [tasks]);

  const counts: Record<string, number> = {};
  for (const z of zones) counts[z.id] = 0;
  for (const t of tasks) if (t.zone_id) counts[t.zone_id] = (counts[t.zone_id] || 0) + 1;

  return (
    <View style={styles.root}>
      <GalaxyCanvas />

      {/* Top bar */}
      <SafeAreaView edges={["top"]} style={styles.topBar}>
        <View>
          <Text style={styles.hello}>Hello, {profile?.name || "Explorer"}</Text>
          <Text style={styles.appName}>NEURA</Text>
        </View>
        <StressBadge level={stress} testID="stress-level-badge" />
      </SafeAreaView>

      {/* Floating zones sidebar */}
      <View style={[styles.sidebar, { top: insets.top + 80 }]} testID="zone-sidebar">
        {zones.length === 0 && (
          <GlassCard strong style={{ padding: 10 }}>
            <Text style={styles.emptyZone}>No zones yet</Text>
          </GlassCard>
        )}
        {zones.map((z) => {
          const color = z.color || zoneColors[z.name] || "#888";
          return (
            <GlassCard key={z.id} strong style={styles.zonePill} testID={`zone-pill-${z.name}`}>
              <View style={[styles.zoneDot, { backgroundColor: color }]} />
              <Text style={styles.zoneName}>{z.name}</Text>
              <View style={[styles.zoneCount, { backgroundColor: color + "33" }]}>
                <Text style={[styles.zoneCountText, { color }]}>{counts[z.id] || 0}</Text>
              </View>
            </GlassCard>
          );
        })}
      </View>

      {/* Bottom AI insight bar */}
      <View style={[styles.insightBar, { bottom: insets.bottom + 80 }]} testID="ai-insight-bar">
        <GlassCard strong style={styles.insightCard}>
          <View style={styles.insightHeader}>
            <Ionicons name="sparkles" size={14} color={colors.gradientStart} />
            <Text style={styles.insightLabel}>NEURA insight</Text>
          </View>
          {loadingInsight ? (
            <ActivityIndicator color={colors.gradientStart} style={{ marginTop: 4 }} />
          ) : (
            <Text style={styles.insightText} testID="ai-insight-text">{insight || "All clear in your galaxy."}</Text>
          )}
        </GlassCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    zIndex: 10,
  },
  hello: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12 },
  appName: { color: colors.text, fontFamily: fonts.headingBlack, fontSize: 22, letterSpacing: 2 },
  sidebar: { position: "absolute", left: spacing.lg, gap: 8, zIndex: 10 },
  zonePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 130,
  },
  zoneDot: { width: 8, height: 8, borderRadius: 4 },
  zoneName: { color: colors.text, fontFamily: fonts.bodyMed, fontSize: 12, flex: 1 },
  zoneCount: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 9999, minWidth: 22, alignItems: "center" },
  zoneCountText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  emptyZone: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12 },
  insightBar: { position: "absolute", left: spacing.md, right: spacing.md, zIndex: 10 },
  insightCard: { paddingVertical: 12, paddingHorizontal: 14 },
  insightHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  insightLabel: { color: colors.gradientStart, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase" },
  insightText: { color: colors.text, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
});
