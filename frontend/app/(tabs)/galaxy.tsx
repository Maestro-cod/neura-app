import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";

import { colors, fonts, spacing, zoneColors, zoneEmojis, ALL_ZONES } from "@/src/theme";
import { GlassCard } from "@/src/components/GlassCard";
import { SkeletonCard } from "@/src/components/SkeletonLoader";
import { useAuth } from "@/src/context/AuthContext";
import { supabase } from "@/src/lib/supabase";
import { api } from "@/src/lib/api";

type Zone = { id: string; name: string; color: string };
type Task = { id: string; title: string; urgency: "low" | "med" | "high"; zone_id: string | null; completed: boolean; due_date: string | null };

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getDateStr(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function getMentalLoadScore(tasks: Task[]): number {
  const openTasks = tasks.filter((t) => !t.completed);
  const overdue = openTasks.filter((t) => t.due_date && new Date(t.due_date) < new Date()).length;
  const score = openTasks.length * 2 + overdue * 10;
  return Math.min(100, score);
}

function getScoreColor(score: number): string {
  if (score <= 30) return colors.stressLow;
  if (score <= 60) return colors.stressMed;
  if (score <= 80) return colors.stressHigh;
  return colors.stressCritical;
}

// Animated circular progress ring component
function CircularProgress({ score, size = 140, strokeWidth = 8 }: { score: number; size?: number; strokeWidth?: number }) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = (score / 100) * circumference;
  const color = getScoreColor(score);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        {/* Background track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${progress} ${circumference - progress}`}
          strokeLinecap="round"
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={[styles.scoreNumber, { color }]}>{score}</Text>
        <Text style={styles.scoreLabel}>Mental Load</Text>
      </View>
    </View>
  );
}

export default function Galaxy() {
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [zones, setZones] = useState<Zone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [insight, setInsight] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: z }, { data: t }] = await Promise.all([
      supabase.from("zones").select("*").eq("user_id", user.id).eq("active", true),
      supabase.from("tasks").select("*").eq("user_id", user.id).eq("completed", false),
    ]);
    setZones((z as any) || []);
    setTasks((t as any) || []);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (!user) return;
    api
      .aiInsight(user.id)
      .then((r) => setInsight(r.insight))
      .catch(() => setInsight("Your galaxy looks balanced. Keep going."));
  }, [user, tasks.length]);

  const mentalLoad = useMemo(() => getMentalLoadScore(tasks), [tasks]);
  const scoreColor = useMemo(() => getScoreColor(mentalLoad), [mentalLoad]);

  const counts: Record<string, number> = {};
  for (const z of zones) counts[z.id] = 0;
  for (const t of tasks) if (t.zone_id) counts[t.zone_id] = (counts[t.zone_id] || 0) + 1;

  // Find most loaded zone
  const mostLoadedZone = useMemo(() => {
    if (!zones.length) return null;
    let maxCount = 0;
    let maxZone: Zone | null = null;
    for (const z of zones) {
      const c = counts[z.id] || 0;
      if (c > maxCount) {
        maxCount = c;
        maxZone = z;
      }
    }
    return maxZone;
  }, [zones, counts]);

  const isBeforeNoon = new Date().getHours() < 12;

  // Build the 6 zone slots (fixed layout)
  const zoneSlots = ALL_ZONES.map((name) => {
    const zone = zones.find((z) => z.name === name);
    return {
      name,
      color: zoneColors[name],
      emoji: zoneEmojis[name],
      zone,
      count: zone ? counts[zone.id] || 0 : 0,
      active: !!zone,
    };
  });

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Top section */}
          <View style={styles.topSection}>
            <Text style={styles.greeting}>{getGreeting()}, {profile?.name || "Explorer"}</Text>
            <Text style={styles.appName}>NEURA</Text>
            <Text style={styles.dateText}>{getDateStr()}</Text>
          </View>

          {/* Mental Load Score Card */}
          {loading ? (
            <SkeletonCard style={{ marginBottom: spacing.lg }} />
          ) : (
            <GlassCard strong style={[styles.mentalLoadCard, { shadowColor: scoreColor }]} testID="mental-load-card">
              <CircularProgress score={mentalLoad} />
              <View style={styles.insightWrap}>
                <View style={styles.insightHeader}>
                  <Ionicons name="sparkles" size={14} color={colors.primary} />
                  <Text style={styles.insightLabel}>AI INSIGHT</Text>
                </View>
                <Text style={styles.insightText}>{insight || "Analyzing your galaxy..."}</Text>
              </View>
            </GlassCard>
          )}

          {/* Zone Planets Grid */}
          <Text style={styles.sectionTitle}>Zone Planets</Text>
          <View style={styles.zonesGrid} testID="zone-sidebar">
            {zoneSlots.map((slot) => (
              <GlassCard
                key={slot.name}
                strong={slot.active}
                style={[
                  styles.zoneCard,
                  !slot.active && styles.zoneCardInactive,
                ]}
                testID={`zone-pill-${slot.name}`}
              >
                <Text style={styles.zoneEmoji}>{slot.emoji}</Text>
                <Text style={[styles.zoneCardName, { color: slot.active ? slot.color : "rgba(255,255,255,0.2)" }]}>
                  {slot.name}
                </Text>
                {slot.active ? (
                  <View style={[styles.zoneBadge, { backgroundColor: slot.color + "22" }]}>
                    <Text style={[styles.zoneBadgeText, { color: slot.color }]}>
                      {slot.count} {slot.count === 1 ? "task" : "tasks"}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.emptyOrbit}>Empty orbit</Text>
                )}
              </GlassCard>
            ))}
          </View>

          {/* Morning Pulse Card — only before noon */}
          {isBeforeNoon && !loading && (
            <GlassCard
              strong
              style={[styles.morningPulse, {
                shadowColor: colors.secondary,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.3,
                shadowRadius: 20,
              }]}
            >
              <Text style={styles.morningTitle}>Morning Pulse ☀️</Text>
              <Text style={styles.morningBody}>
                You have {tasks.length} active {tasks.length === 1 ? "task" : "tasks"}
                {mostLoadedZone
                  ? `. Your most loaded zone is ${mostLoadedZone.name}.`
                  : "."}
              </Text>
              <Pressable style={styles.focusButton}>
                <Text style={styles.focusButtonText}>Start Focus</Text>
              </Pressable>
            </GlassCard>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.lg },
  topSection: { marginBottom: spacing.xl },
  greeting: {
    color: colors.textDim,
    fontFamily: fonts.body,
    fontSize: 14,
    letterSpacing: -0.3,
  },
  appName: {
    color: colors.text,
    fontFamily: fonts.headingBlack,
    fontSize: 36,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  dateText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 4,
  },
  mentalLoadCard: {
    alignItems: "center",
    gap: 16,
    marginBottom: spacing.xl,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 10,
  },
  scoreNumber: {
    fontFamily: fonts.headingBlack,
    fontSize: 42,
    letterSpacing: -1,
  },
  scoreLabel: {
    color: colors.textDim,
    fontFamily: fonts.bodyMed,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  insightWrap: { width: "100%", paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.glassBorder },
  insightHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  insightLabel: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1,
  },
  insightText: {
    color: colors.textDim,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionTitle: {
    color: colors.textDim,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: spacing.md,
  },
  zonesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: spacing.xl,
  },
  zoneCard: {
    width: "31.5%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 6,
  },
  zoneCardInactive: {
    opacity: 0.4,
  },
  zoneEmoji: {
    fontSize: 28,
  },
  zoneCardName: {
    fontFamily: fonts.bodyMed,
    fontSize: 12,
    letterSpacing: -0.3,
  },
  zoneBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  zoneBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
  },
  emptyOrbit: {
    color: "rgba(255,255,255,0.15)",
    fontFamily: fonts.body,
    fontSize: 10,
  },
  morningPulse: {
    borderColor: colors.secondary + "44",
    marginBottom: spacing.lg,
  },
  morningTitle: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 18,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  morningBody: {
    color: colors.textDim,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  focusButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 9999,
    alignSelf: "flex-start",
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  focusButtonText: {
    color: "#FFFFFF",
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    letterSpacing: -0.3,
  },
});
