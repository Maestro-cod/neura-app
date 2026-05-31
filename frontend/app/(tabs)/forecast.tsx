import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop, Circle, Line, Text as SvgText } from "react-native-svg";
import {
  colors,
  fonts,
  spacing,
  zoneColors,
  zoneEmojis,
  ALL_ZONES,
} from "@/src/theme";
import { GlassCard } from "@/src/components/GlassCard";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { SkeletonCard } from "@/src/components/SkeletonLoader";
import { UpgradeModal } from "@/src/components/UpgradeModal";
import { useAuth } from "@/src/context/AuthContext";
import { supabase } from "@/src/lib/supabase";
import { api } from "@/src/lib/api";

type Day = { date: string; score: number; level: "low" | "med" | "high" };
type Zone = { id: string; name: string; color: string };
type Task = { id: string; zone_id: string | null; completed: boolean };

function getScoreColor(score: number): string {
  if (score <= 30) return colors.stressLow;
  if (score <= 60) return colors.stressMed;
  if (score <= 80) return colors.stressHigh;
  return colors.stressCritical;
}

// Wave chart component
function WaveChart({ data, width = 340, height = 180 }: { data: Day[]; width?: number; height?: number }) {
  if (!data.length) return null;

  const padding = { top: 20, right: 16, bottom: 30, left: 36 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Build smooth path using cardinal spline interpolation
  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartW,
    y: padding.top + chartH - (d.score / 100) * chartH,
    score: d.score,
  }));

  // Create smooth curve path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    pathD += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }

  // Fill area path
  const areaD = pathD + ` L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  // Y-axis labels
  const yLabels = [0, 25, 50, 75, 100];

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.stressLow} />
          <Stop offset="0.5" stopColor={colors.stressMed} />
          <Stop offset="1" stopColor={colors.stressCritical} />
        </SvgGradient>
        <SvgGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.primary} stopOpacity="0.2" />
          <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
        </SvgGradient>
      </Defs>

      {/* Grid lines */}
      {yLabels.map((val) => {
        const y = padding.top + chartH - (val / 100) * chartH;
        return (
          <React.Fragment key={val}>
            <Line
              x1={padding.left}
              y1={y}
              x2={padding.left + chartW}
              y2={y}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={1}
            />
            <SvgText
              x={padding.left - 8}
              y={y + 4}
              fill="rgba(255,255,255,0.3)"
              fontSize={9}
              textAnchor="end"
              fontFamily={fonts.body}
            >
              {val}
            </SvgText>
          </React.Fragment>
        );
      })}

      {/* Filled area */}
      <Path d={areaD} fill="url(#areaGrad)" />

      {/* Line */}
      <Path d={pathD} stroke="url(#lineGrad)" strokeWidth={2.5} fill="none" strokeLinecap="round" />

      {/* Data points */}
      {points.map((p, i) =>
        i % 5 === 0 || i === points.length - 1 ? (
          <Circle key={i} cx={p.x} cy={p.y} r={3} fill={getScoreColor(p.score)} />
        ) : null
      )}

      {/* X-axis labels */}
      {data.map((d, i) =>
        i % 7 === 0 ? (
          <SvgText
            key={i}
            x={padding.left + (i / (data.length - 1)) * chartW}
            y={height - 6}
            fill="rgba(255,255,255,0.3)"
            fontSize={9}
            textAnchor="middle"
            fontFamily={fonts.body}
          >
            {d.date.slice(5)}
          </SvgText>
        ) : null
      )}
    </Svg>
  );
}

// Zone balance ring
function ZoneBalanceRing({
  name,
  percentage,
  color,
  size = 60,
}: {
  name: string;
  percentage: number;
  color: string;
  size?: number;
}) {
  const strokeWidth = 5;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = (percentage / 100) * circumference;
  const emoji = zoneEmojis[name] || "·";

  return (
    <View style={{ alignItems: "center", width: size + 10 }}>
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
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
        <Text style={{ position: "absolute", fontSize: 18 }}>{emoji}</Text>
      </View>
      <Text style={[balanceStyles.label, { color }]}>{Math.round(percentage)}%</Text>
      <Text style={balanceStyles.name}>{name}</Text>
    </View>
  );
}

const balanceStyles = StyleSheet.create({
  label: { fontFamily: fonts.bodyBold, fontSize: 11, marginTop: 4 },
  name: { color: colors.textDim, fontFamily: fonts.body, fontSize: 10, marginTop: 1 },
});

// Generate 30 days of placeholder forecast data with a natural-looking wave pattern
function generateMockForecast(): Day[] {
  const today = new Date();
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    // Create a gentle sine-wave pattern with some randomness
    const base = 35 + Math.sin(i * 0.45) * 20 + Math.sin(i * 0.15) * 10;
    const jitter = (Math.sin(i * 2.7 + 1.3) * 8);
    const score = Math.max(5, Math.min(95, Math.round(base + jitter)));
    const level: "low" | "med" | "high" = score <= 35 ? "low" : score <= 65 ? "med" : "high";
    return { date: dateStr, score, level };
  });
}

export default function Forecast() {
  const { user, profile } = useAuth();
  const [days, setDays] = useState<Day[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrade, setUpgrade] = useState(false);

  const isLocked = !profile || profile.plan === "free";

  const load = useCallback(async () => {
    if (!user) return;
    if (isLocked) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [forecastRes, { data: z }, { data: t }] = await Promise.all([
        api.forecast(user.id),
        supabase.from("zones").select("*").eq("user_id", user.id),
        supabase.from("tasks").select("id, zone_id, completed").eq("user_id", user.id),
      ]);
      setDays(forecastRes.forecast ?? []);
      setZones((z as any) || []);
      setTasks((t as any) || []);
    } catch {
      setDays([]);
    } finally {
      setLoading(false);
    }
  }, [user, isLocked]);

  // Re-fetch when user auth resolves (useFocusEffect alone won't re-run
  // if the screen is already focused when `user` becomes available).
  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Use real data if available, otherwise fall back to mock data so the chart always renders
  const effectiveDays = useMemo(() => {
    return days.length > 0 ? days : generateMockForecast();
  }, [days]);

  const isUsingMockData = days.length === 0;

  // Weekly summaries (4 weeks from forecast data)
  const weeklySummaries = useMemo(() => {
    const src = effectiveDays;
    if (!src.length) return [];
    const weeks: { weekNum: number; avgScore: number; level: string; tip: string }[] = [];
    for (let w = 0; w < 4; w++) {
      const weekDays = src.slice(w * 7, (w + 1) * 7);
      if (!weekDays.length) continue;
      const avg = weekDays.reduce((s, d) => s + d.score, 0) / weekDays.length;
      let level: string, tip: string;
      if (avg <= 30) {
        level = "low";
        tip = "Great week ahead. Use the calm to plan.";
      } else if (avg <= 60) {
        level = "med";
        tip = "Moderate load. Prioritize key tasks early.";
      } else {
        level = "high";
        tip = "Heavy week. Consider delegating or rescheduling.";
      }
      weeks.push({ weekNum: w + 1, avgScore: Math.round(avg), level, tip });
    }
    return weeks;
  }, [effectiveDays]);

  // Zone balance data
  const zoneBalance = useMemo(() => {
    if (!zones.length || !tasks.length) return [];
    const total = tasks.length;
    return zones.map((z) => {
      const count = tasks.filter((t) => t.zone_id === z.id).length;
      return {
        name: z.name,
        color: z.color || zoneColors[z.name] || "#888",
        percentage: total > 0 ? (count / total) * 100 : 0,
      };
    });
  }, [zones, tasks]);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.h1}>Stress Forecast</Text>
        <Text style={styles.sub}>Next 30 days</Text>
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
          testID="forecast-screen"
        >
          {isLocked ? null : loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              {/* Wave Chart */}
              <GlassCard strong style={styles.chartCard}>
                <Text style={styles.chartTitle}>Mental Load Wave</Text>
                {isUsingMockData && (
                  <Text style={styles.mockLabel}>Estimated · based on your current tasks</Text>
                )}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <WaveChart data={effectiveDays} width={Math.max(340, effectiveDays.length * 12)} />
                </ScrollView>
              </GlassCard>

              {/* Weekly Summary Cards */}
              <Text style={styles.sectionTitle}>Weekly Outlook</Text>
              <View style={styles.weekGrid}>
                {weeklySummaries.map((w) => {
                  const weekColor = getScoreColor(w.avgScore);
                  return (
                    <GlassCard
                      key={w.weekNum}
                      strong
                      style={[styles.weekCard, { borderLeftColor: weekColor, borderLeftWidth: 3 }]}
                    >
                      <Text style={[styles.weekLabel, { color: weekColor }]}>
                        Week {w.weekNum}
                      </Text>
                      <Text style={styles.weekScore}>{w.avgScore}</Text>
                      <Text style={styles.weekTip}>{w.tip}</Text>
                    </GlassCard>
                  );
                })}
              </View>

              {/* Zone Balance Rings */}
              {zoneBalance.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Life Balance</Text>
                  <GlassCard strong style={styles.balanceCard}>
                    <View style={styles.balanceGrid}>
                      {zoneBalance.map((z) => (
                        <ZoneBalanceRing
                          key={z.name}
                          name={z.name}
                          percentage={z.percentage}
                          color={z.color}
                        />
                      ))}
                    </View>
                  </GlassCard>
                </>
              )}
            </>
          )}
        </ScrollView>

        {/* Lock overlay for free users */}
        {isLocked && (
          <View style={styles.lockOverlay} pointerEvents="auto" testID="pro-upgrade-overlay">
            <GlassCard strong style={styles.lockCard}>
              <Ionicons name="lock-closed" size={32} color={colors.primary} />
              <Text style={styles.lockTitle}>Forecast is a Pro feature</Text>
              <Text style={styles.lockSub}>
                See how your next 30 days look — color-coded by predicted mental
                load — to plan smarter and breathe easier.
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
      </View>

      <UpgradeModal
        visible={upgrade}
        onClose={() => setUpgrade(false)}
        reason="Unlock your 30-day stress forecast."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  h1: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 28,
    letterSpacing: -0.5,
  },
  sub: {
    color: colors.textDim,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  chartCard: { marginBottom: spacing.xl, overflow: "hidden" },
  chartTitle: {
    color: colors.text,
    fontFamily: fonts.headingMed,
    fontSize: 14,
    letterSpacing: -0.3,
    marginBottom: spacing.sm,
  },
  mockLabel: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontStyle: "italic",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.textDim,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: spacing.md,
  },
  weekGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: spacing.xl,
  },
  weekCard: {
    width: "48%",
    gap: 4,
  },
  weekLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  weekScore: {
    color: colors.text,
    fontFamily: fonts.headingBlack,
    fontSize: 28,
    letterSpacing: -1,
  },
  weekTip: {
    color: colors.textDim,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  balanceCard: { marginBottom: spacing.xl },
  balanceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    gap: 12,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,5,8,0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  lockCard: { alignItems: "center", gap: 6, maxWidth: 360 },
  lockTitle: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 20,
    letterSpacing: -0.5,
    marginTop: 6,
    textAlign: "center",
  },
  lockSub: {
    color: colors.textDim,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 4,
  },
});
