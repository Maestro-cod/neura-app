import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing, zoneColors, zoneEmojis, ALL_ZONES, zoneIcons } from "@/src/theme";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { GlassCard } from "@/src/components/GlassCard";
import { GalaxyCanvas } from "@/src/components/GalaxyCanvas";
import { UrgencyBadge } from "@/src/components/UrgencyBadge";
import { useAuth } from "@/src/context/AuthContext";
import { supabase } from "@/src/lib/supabase";

type Urgency = "low" | "med" | "high";
type DraftTask = { title: string; zone: string; urgency: Urgency };

export default function Onboarding() {
  const router = useRouter();
  const { user, reloadProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const tz = Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || "UTC";
  const [timezone] = useState(tz);
  const [zones, setZones] = useState<string[]>(["Health", "Work", "Self"]);
  const [tasks, setTasks] = useState<DraftTask[]>([{ title: "", zone: "Health", urgency: "med" }]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggleZone = (z: string) => {
    setZones((cur) => (cur.includes(z) ? cur.filter((x) => x !== z) : [...cur, z]));
  };

  const updateTask = (i: number, patch: Partial<DraftTask>) => {
    setTasks((cur) => cur.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  };
  const addTaskRow = () => {
    if (tasks.length >= 3) return;
    setTasks((cur) => [...cur, { title: "", zone: zones[0] || "Health", urgency: "med" }]);
  };

  const finish = async () => {
    if (!user) return;
    if (!name.trim()) {
      setStep(0);
      setErr("Please enter your name.");
      return;
    }
    if (zones.length === 0) {
      setStep(1);
      setErr("Pick at least one life zone.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      // Update profile
      await supabase
        .from("profiles")
        .update({ name: name.trim(), timezone, onboarded: true })
        .eq("id", user.id);

      // Insert zones
      const zoneRows = zones.map((z) => ({
        user_id: user.id,
        name: z,
        color: zoneColors[z],
        icon: zoneIcons[z],
        active: true,
      }));
      const { data: insertedZones } = await supabase.from("zones").insert(zoneRows).select();

      // Insert tasks (only those with a title)
      const valid = tasks.filter((t) => t.title.trim());
      if (valid.length && insertedZones) {
        const zoneMap: Record<string, string> = {};
        insertedZones.forEach((z: any) => (zoneMap[z.name] = z.id));
        const taskRows = valid.map((t) => ({
          user_id: user.id,
          zone_id: zoneMap[t.zone] || null,
          title: t.title.trim(),
          urgency: t.urgency,
        }));
        await supabase.from("tasks").insert(taskRows);
      }
      await reloadProfile();
      router.replace("/(tabs)/galaxy");
    } catch (e: any) {
      setErr(e?.message ?? "Could not finish onboarding.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <GalaxyCanvas />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.progress}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[styles.progressDot, { backgroundColor: i <= step ? colors.gradientStart : colors.glassBg }]}
                />
              ))}
            </View>
            <Text style={styles.step}>Step {step + 1} of 3</Text>

            {step === 0 && (
              <GlassCard strong style={styles.card} testID="onboarding-step-1">
                <Text style={styles.h1}>Welcome to NEURA</Text>
                <Text style={styles.sub}>Let's set up your mental galaxy.</Text>
                <Text style={styles.label}>Your name</Text>
                <TextInput
                  testID="onboarding-name-input"
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Maya"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                />
                <Text style={styles.label}>Timezone</Text>
                <View style={styles.tzPill}>
                  <Ionicons name="globe-outline" size={14} color={colors.textDim} />
                  <Text style={styles.tzText}>{timezone}</Text>
                </View>
              </GlassCard>
            )}

            {step === 1 && (
              <GlassCard strong style={styles.card} testID="onboarding-step-2">
                <Text style={styles.h1}>Which zones matter?</Text>
                <Text style={styles.sub}>Tap the areas of life you want NEURA to help you manage.</Text>
                <View style={styles.zonesGrid}>
                  {ALL_ZONES.map((z) => {
                    const selected = zones.includes(z);
                    const color = zoneColors[z];
                    return (
                      <Pressable
                        key={z}
                        testID={`zone-card-${z}`}
                        onPress={() => toggleZone(z)}
                        style={({ pressed }) => [
                          styles.zoneCard,
                          {
                            borderColor: selected ? color : colors.glassBorder,
                            backgroundColor: selected ? color + "1A" : colors.glassBg,
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}
                      >
                        <View style={[styles.zoneIcon, { backgroundColor: color + "33" }]}>
                          <Text style={{ fontSize: 22 }}>{zoneEmojis[z] || "·"}</Text>
                        </View>
                        <Text style={styles.zoneCardLabel}>{z}</Text>
                        {selected && (
                          <Ionicons name="checkmark-circle" size={16} color={color} style={{ position: "absolute", top: 8, right: 8 }} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </GlassCard>
            )}

            {step === 2 && (
              <GlassCard strong style={styles.card} testID="onboarding-step-3">
                <Text style={styles.h1}>Add your first 3 tasks</Text>
                <Text style={styles.sub}>Start small. Anything on your mind right now.</Text>
                {tasks.map((t, i) => (
                  <View key={i} style={styles.taskRow}>
                    <TextInput
                      testID={`onboarding-task-input-${i}`}
                      value={t.title}
                      onChangeText={(txt) => updateTask(i, { title: txt })}
                      placeholder={`Task ${i + 1}`}
                      placeholderTextColor={colors.textMuted}
                      style={[styles.input, { marginTop: 0 }]}
                    />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        {zones.map((z) => (
                          <Pressable
                            key={z}
                            onPress={() => updateTask(i, { zone: z })}
                            testID={`task-${i}-zone-${z}`}
                            style={[
                              styles.miniChip,
                              {
                                borderColor: t.zone === z ? zoneColors[z] : colors.glassBorder,
                                backgroundColor: t.zone === z ? zoneColors[z] + "22" : colors.glassBg,
                              },
                            ]}
                          >
                            <Text style={{ color: t.zone === z ? zoneColors[z] : colors.textDim, fontFamily: fonts.bodyMed, fontSize: 11 }}>
                              {z}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                      {(["low", "med", "high"] as Urgency[]).map((u) => (
                        <Pressable
                          key={u}
                          onPress={() => updateTask(i, { urgency: u })}
                          testID={`task-${i}-urgency-${u}`}
                          style={{ opacity: t.urgency === u ? 1 : 0.45 }}
                        >
                          <UrgencyBadge urgency={u} />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}
                {tasks.length < 3 && (
                  <SecondaryButton title="+ Add another" onPress={addTaskRow} testID="onboarding-add-task" />
                )}
              </GlassCard>
            )}

            {err && <Text style={styles.err}>{err}</Text>}

            <View style={styles.nav}>
              {step > 0 && (
                <SecondaryButton
                  title="Back"
                  onPress={() => setStep((s) => Math.max(0, s - 1))}
                  style={{ flex: 1 }}
                  testID="onboarding-back"
                />
              )}
              {step < 2 ? (
                <PrimaryButton
                  title="Continue"
                  onPress={() => {
                    setErr(null);
                    setStep((s) => s + 1);
                  }}
                  testID={`onboarding-step-${step + 1}-next`}
                  style={{ flex: 1 }}
                />
              ) : (
                <PrimaryButton
                  title={saving ? "Setting up..." : "Enter NEURA"}
                  loading={saving}
                  onPress={finish}
                  testID="onboarding-finish"
                  style={{ flex: 1 }}
                />
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  scroll: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
  progress: { flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 6 },
  progressDot: { width: 40, height: 5, borderRadius: 9999 },
  step: { color: colors.textDim, fontFamily: fonts.bodyMed, fontSize: 12, textAlign: "center", marginBottom: spacing.sm },
  card: { gap: 6 },
  h1: { color: colors.text, fontFamily: fonts.heading, fontSize: 24, letterSpacing: -0.5 },
  sub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13, marginBottom: spacing.md },
  label: { color: colors.textDim, fontFamily: fonts.bodyMed, fontSize: 12, marginTop: spacing.sm, marginBottom: 4 },
  input: {
    backgroundColor: colors.glassBg,
    borderColor: colors.glassBorderStrong,
    borderWidth: 1,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.button,
    fontFamily: fonts.body,
    fontSize: 14,
    marginTop: 4,
  },
  tzPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.glassBg,
    borderColor: colors.glassBorder,
    borderWidth: 1,
    borderRadius: radius.button,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  tzText: { color: colors.text, fontFamily: fonts.body, fontSize: 13 },
  zonesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: spacing.sm },
  zoneCard: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  zoneIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  zoneCardLabel: { color: colors.text, fontFamily: fonts.bodyMed, fontSize: 13 },
  taskRow: { marginBottom: spacing.md },
  miniChip: { paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderRadius: 9999 },
  err: { color: "#ff6b6b", textAlign: "center", fontFamily: fonts.body, fontSize: 13 },
  nav: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
});
