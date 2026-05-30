import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";

import { colors, fonts, spacing, zoneColors, zoneEmojis, ALL_ZONES } from "@/src/theme";
import { GlassCard } from "@/src/components/GlassCard";
import { GalaxyCanvas, GalaxyZone } from "@/src/components/GalaxyCanvas";
import { SkeletonCard } from "@/src/components/SkeletonLoader";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { useAuth } from "@/src/context/AuthContext";
import { supabase } from "@/src/lib/supabase";
import { api } from "@/src/lib/api";

type Zone = { id: string; name: string; color: string };
type Task = {
  id: string;
  title: string;
  urgency: "low" | "med" | "high";
  zone_id: string | null;
  completed: boolean;
  due_date: string | null;
};

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
  const overdue = openTasks.filter(
    (t) => t.due_date && new Date(t.due_date) < new Date()
  ).length;
  const score = openTasks.length * 2 + overdue * 10;
  return Math.min(100, score);
}

function getScoreColor(score: number): string {
  if (score <= 30) return colors.stressLow;
  if (score <= 60) return colors.stressMed;
  if (score <= 80) return colors.stressHigh;
  return colors.stressCritical;
}

// ── Circular progress ring component ─────────────────────────────────────────
function CircularProgress({
  score,
  size = 100,
  strokeWidth = 6,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = (score / 100) * circumference;
  const color = getScoreColor(score);

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg
        width={size}
        height={size}
        style={{ transform: [{ rotate: "-90deg" }] }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
          fill="none"
        />
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
        <Text style={styles.scoreLabel}>Load</Text>
      </View>
    </View>
  );
}

// ── Zone detail bottom card ──────────────────────────────────────────────────
function ZoneDetailCard({
  zone,
  taskCount,
  onClose,
  onViewTasks,
}: {
  zone: GalaxyZone;
  taskCount: number;
  onClose: () => void;
  onViewTasks: () => void;
}) {
  const color = zone.color || zoneColors[zone.name] || "#888";
  const emoji = zoneEmojis[zone.name] || "·";

  return (
    <GlassCard
      strong
      style={[
        styles.zoneDetailCard,
        {
          borderLeftColor: color,
          borderLeftWidth: 3,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 20,
          elevation: 10,
        },
      ]}
    >
      <View style={styles.zoneDetailHeader}>
        <Text style={{ fontSize: 28 }}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.zoneDetailName, { color }]}>{zone.name}</Text>
          <Text style={styles.zoneDetailCount}>
            {taskCount} {taskCount === 1 ? "task" : "tasks"} in orbit
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={20} color={colors.textDim} />
        </Pressable>
      </View>
      <PrimaryButton
        title="View Tasks →"
        onPress={onViewTasks}
        color={color}
        style={{ marginTop: spacing.md }}
      />
    </GlassCard>
  );
}

// ── Main Galaxy Screen ───────────────────────────────────────────────────────
export default function Galaxy() {
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [zones, setZones] = useState<Zone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [insight, setInsight] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState<GalaxyZone | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [zRes, tRes] = await Promise.all([
        supabase.from("zones").select("*").eq("user_id", user.id),
        supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .eq("completed", false),
      ]);
      setZones((zRes.data as any) ?? []);
      setTasks((tRes.data as any) ?? []);
    } catch (_e) {
      // keep previous state on network error
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Re-fetch when user auth resolves (not only on focus)
  useEffect(() => {
    load();
  }, [load]);

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

  // ── Derived data ───────────────────────────────────────────────────────────
  const mentalLoad = useMemo(() => getMentalLoadScore(tasks), [tasks]);
  const scoreColor = useMemo(() => getScoreColor(mentalLoad), [mentalLoad]);

  // Task counts per zone
  const counts: Record<string, number> = useMemo(() => {
    const c: Record<string, number> = {};
    for (const z of zones) c[z.id] = 0;
    for (const t of tasks) {
      if (t.zone_id) c[t.zone_id] = (c[t.zone_id] || 0) + 1;
    }
    return c;
  }, [zones, tasks]);

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

  // Enriched zones for the canvas
  const canvasZones: GalaxyZone[] = useMemo(
    () =>
      zones.map((z) => ({
        id: z.id,
        name: z.name,
        color: z.color || zoneColors[z.name] || "#888",
      })),
    [zones]
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handlePlanetTap = useCallback(
    (zone: GalaxyZone) => {
      setSelectedZone(zone);
    },
    []
  );

  const handlePlanetDoubleTap = useCallback(
    (zone: GalaxyZone) => {
      setSelectedZone(zone);
    },
    []
  );

  const handleViewTasks = useCallback(() => {
    setSelectedZone(null);
    router.push("/(tabs)/tasks");
  }, [router]);

  return (
    <View style={styles.root}>
      {/* ── Full-screen Galaxy Canvas (background) ── */}
      <GalaxyCanvas
        zones={canvasZones}
        taskCounts={counts}
        onPlanetTap={handlePlanetTap}
        onPlanetDoubleTap={handlePlanetDoubleTap}
      />

      {/* ── Top Overlay: Greeting + Mental Load ── */}
      <SafeAreaView
        edges={["top"]}
        style={styles.topOverlay}
        pointerEvents="box-none"
      >
        <LinearGradient
          colors={["rgba(5,5,8,0.92)", "rgba(5,5,8,0.6)", "transparent"]}
          style={styles.topGradient}
          pointerEvents="auto"
        >
          <View style={styles.topBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>
                {getGreeting()}, {profile?.name || "Explorer"}
              </Text>
              <Text style={styles.appName}>NEURA</Text>
            </View>
            {!loading && <CircularProgress score={mentalLoad} />}
          </View>
        </LinearGradient>
      </SafeAreaView>

      {/* ── Bottom Overlay: AI Insight bar ── */}
      <View
        style={[styles.bottomOverlay, { bottom: insets.bottom + 78 }]}
        pointerEvents="box-none"
      >
        <View pointerEvents="auto">
          <GlassCard strong style={styles.insightCard} testID="ai-insight-bar">
            <View style={styles.insightHeader}>
              <Ionicons name="sparkles" size={14} color={colors.primary} />
              <Text style={styles.insightLabel}>NEURA INSIGHT</Text>
            </View>
            <Text style={styles.insightText} testID="ai-insight-text">
              {insight || "Analyzing your galaxy..."}
            </Text>

            {/* Morning Pulse mini-section */}
            {isBeforeNoon && !loading && tasks.length > 0 && (
              <View style={styles.morningPulseRow}>
                <Text style={styles.morningText}>
                  ☀️ {tasks.length} active{" "}
                  {tasks.length === 1 ? "task" : "tasks"}
                  {mostLoadedZone
                    ? ` · Most loaded: ${mostLoadedZone.name}`
                    : ""}
                </Text>
              </View>
            )}
          </GlassCard>
        </View>
      </View>

      {/* ── Zone Detail Card (appears on planet tap) ── */}
      {selectedZone && (
        <View
          style={[styles.zoneDetailOverlay, { bottom: insets.bottom + 78 }]}
          pointerEvents="box-none"
        >
          <View pointerEvents="auto">
            <ZoneDetailCard
              zone={selectedZone}
              taskCount={counts[selectedZone.id] || 0}
              onClose={() => setSelectedZone(null)}
              onViewTasks={handleViewTasks}
            />
          </View>
        </View>
      )}

      {/* ── Zone legend (floating left sidebar) ── */}
      <View
        style={[styles.legendOverlay, { top: insets.top + 100 }]}
        pointerEvents="box-none"
        testID="zone-sidebar"
      >
        <View pointerEvents="auto">
          {zones.length > 0 ? (
            zones.map((z) => {
              const color = z.color || zoneColors[z.name] || "#888";
              return (
                <Pressable
                  key={z.id}
                  onPress={() =>
                    setSelectedZone({
                      id: z.id,
                      name: z.name,
                      color,
                    })
                  }
                  testID={`zone-pill-${z.name}`}
                >
                  <GlassCard
                    strong
                    style={styles.legendPill}
                  >
                    <View
                      style={[styles.legendDot, { backgroundColor: color }]}
                    />
                    <Text style={[styles.legendName, { color }]}>
                      {z.name}
                    </Text>
                    <Text style={[styles.legendCount, { color }]}>
                      {counts[z.id] || 0}
                    </Text>
                  </GlassCard>
                </Pressable>
              );
            })
          ) : (
            <GlassCard strong style={styles.legendPill}>
              <Text style={styles.legendEmpty}>No zones yet</Text>
            </GlassCard>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  // Top overlay
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topGradient: {
    paddingBottom: spacing.xl,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  greeting: {
    color: colors.textDim,
    fontFamily: fonts.body,
    fontSize: 13,
    letterSpacing: -0.3,
  },
  appName: {
    color: colors.text,
    fontFamily: fonts.headingBlack,
    fontSize: 28,
    letterSpacing: -0.5,
    marginTop: 1,
  },
  scoreNumber: {
    fontFamily: fonts.headingBlack,
    fontSize: 28,
    letterSpacing: -1,
  },
  scoreLabel: {
    color: colors.textDim,
    fontFamily: fonts.bodyMed,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  // Bottom insight overlay
  bottomOverlay: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    zIndex: 10,
  },
  insightCard: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  insightLabel: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1,
  },
  insightText: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  morningPulseRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  morningText: {
    color: colors.textDim,
    fontFamily: fonts.bodyMed,
    fontSize: 12,
  },

  // Zone detail card
  zoneDetailOverlay: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    zIndex: 20,
  },
  zoneDetailCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  zoneDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  zoneDetailName: {
    fontFamily: fonts.heading,
    fontSize: 20,
    letterSpacing: -0.5,
  },
  zoneDetailCount: {
    color: colors.textDim,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 2,
  },

  // Legend sidebar
  legendOverlay: {
    position: "absolute",
    left: spacing.md,
    zIndex: 10,
    gap: 6,
  },
  legendPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 90,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendName: {
    fontFamily: fonts.bodyMed,
    fontSize: 11,
    flex: 1,
    letterSpacing: -0.3,
  },
  legendCount: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  legendEmpty: {
    color: colors.textDim,
    fontFamily: fonts.body,
    fontSize: 11,
  },
});
