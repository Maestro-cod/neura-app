import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import {
  colors,
  fonts,
  radius,
  spacing,
  zoneColors,
  zoneEmojis,
  emotionEmojis,
  glowShadow,
} from "@/src/theme";
import { GlassCard } from "@/src/components/GlassCard";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { SkeletonCard } from "@/src/components/SkeletonLoader";
import { UpgradeModal } from "@/src/components/UpgradeModal";
import { useAuth } from "@/src/context/AuthContext";
import { supabase } from "@/src/lib/supabase";

type Zone = { id: string; name: string; color: string };
type Recurrence = "daily" | "weekly" | "monthly";
type Task = {
  id: string;
  title: string;
  urgency: "low" | "med" | "high";
  zone_id: string | null;
  notes: string | null;
  due_date: string | null;
  completed: boolean;
  emotion?: string | null;
  recurrence?: Recurrence | null;
};

const FREE_TASK_LIMIT = 15;
const RECURRENCE_LABELS: Record<Recurrence, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

// Next due date for a recurring task: advance from its due date (or today).
function nextDueDate(current: string | null, recurrence: Recurrence): string {
  const d = current ? new Date(current) : new Date();
  if (recurrence === "daily") d.setDate(d.getDate() + 1);
  else if (recurrence === "weekly") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

function SwipeableTask({
  children,
  onComplete,
  onDelete,
}: {
  children: React.ReactNode;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;

  const onRelease = () => {
    const current = (translateX as any)._value;
    if (current > 80) {
      // Swipe right → complete
      Animated.timing(translateX, { toValue: 400, duration: 200, useNativeDriver: true }).start(() => {
        onComplete();
        translateX.setValue(0);
      });
    } else if (current < -80) {
      // Swipe left → delete
      Animated.timing(translateX, { toValue: -400, duration: 200, useNativeDriver: true }).start(() => {
        onDelete();
        translateX.setValue(0);
      });
    } else {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    }
  };

  const { PanResponder } = require("react-native");
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_: any, g: any) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_: any, g: any) => translateX.setValue(g.dx),
      onPanResponderRelease: onRelease,
      onPanResponderTerminate: onRelease,
    })
  ).current;

  return (
    <View style={{ position: "relative", marginBottom: spacing.sm }}>
      {/* Swipe hint backgrounds */}
      <View style={[styles.swipeBg, { left: 0, backgroundColor: colors.success + "33" }]}>
        <Ionicons name="checkmark" size={20} color={colors.success} />
      </View>
      <View style={[styles.swipeBg, { right: 0, backgroundColor: colors.danger + "33", alignItems: "flex-end" }]}>
        <Ionicons name="trash" size={20} color={colors.danger} />
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

export default function Tasks() {
  const { user, profile } = useAuth();
  const [zones, setZones] = useState<Zone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [activeZoneFilter, setActiveZoneFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!user) {
      // Auth not ready yet — clear skeleton so the screen isn't stuck.
      // useEffect will re-run load() once user becomes available.
      setLoading(false);
      return;
    }
    console.log("[Tasks] loading data for user:", user.id);
    setLoading(true);

    // 10-second deadline: if Supabase never responds, stop showing skeleton.
    const deadline = setTimeout(() => {
      console.warn("[Tasks] query timed out — showing empty state");
      setLoading(false);
    }, 10000);

    try {
      const [zRes, tRes] = await Promise.all([
        supabase.from("zones").select("*").eq("user_id", user.id),
        supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (zRes.error) {
        console.error("[Tasks] zones error:", zRes.error.code, zRes.error.message);
      } else {
        console.log("[Tasks] zones loaded:", zRes.data?.length ?? 0);
      }

      if (tRes.error) {
        console.error("[Tasks] tasks error:", tRes.error.code, tRes.error.message);
      } else {
        console.log("[Tasks] tasks loaded:", tRes.data?.length ?? 0);
      }

      setZones((zRes.data as any) ?? []);
      setTasks((tRes.data as any) ?? []);
    } catch (e: any) {
      console.error("[Tasks] load exception:", e?.message);
    } finally {
      clearTimeout(deadline);
      setLoading(false);
    }
  }, [user]);

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

  const openAdd = () => {
    const openCount = tasks.filter((t) => !t.completed).length;
    if (profile?.plan === "free" && openCount >= FREE_TASK_LIMIT) {
      setShowUpgrade(true);
      return;
    }
    setEditing(null);
    setShowAdd(true);
  };

  const openEdit = (t: Task) => {
    setEditing(t);
    setShowAdd(true);
  };

  const toggleComplete = async (t: Task) => {
    const completed = !t.completed;
    setTasks((cur) => cur.map((x) => (x.id === t.id ? { ...x, completed } : x)));
    await supabase
      .from("tasks")
      .update({ completed, completed_at: completed ? new Date().toISOString() : null })
      .eq("id", t.id);

    // Recurring task just completed → spawn the next occurrence.
    if (completed && t.recurrence && user) {
      const { data } = await supabase
        .from("tasks")
        .insert({
          user_id: user.id,
          zone_id: t.zone_id,
          title: t.title,
          urgency: t.urgency,
          notes: t.notes,
          due_date: nextDueDate(t.due_date, t.recurrence),
          recurrence: t.recurrence,
        })
        .select();
      if (data?.[0]) setTasks((cur) => [data[0] as any, ...cur]);
    }
  };

  const removeTask = async (t: Task) => {
    setTasks((cur) => cur.filter((x) => x.id !== t.id));
    await supabase.from("tasks").delete().eq("id", t.id);
  };

  const updateEmotion = async (task: Task, emotion: string) => {
    setTasks((cur) =>
      cur.map((x) => (x.id === task.id ? { ...x, emotion } : x))
    );
    // emotion column may not exist yet — ignore errors silently
    const { error } = await supabase.from("tasks").update({ emotion }).eq("id", task.id);
    if (error) {
      console.warn("[updateEmotion] failed (emotion column may not exist):", error.message);
    }
  };

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (activeZoneFilter) result = result.filter((t) => t.zone_id === activeZoneFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q));
    }
    return result;
  }, [tasks, activeZoneFilter, search]);

  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const openCount = tasks.filter((t) => !t.completed).length;
  const doneCount = tasks.filter((t) => t.completed).length;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Your Orbit</Text>
          <Text style={styles.sub}>{openCount} open · {doneCount} done</Text>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search tasks..."
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Zone filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <Pressable
          onPress={() => setActiveZoneFilter(null)}
          style={[
            styles.filterPill,
            !activeZoneFilter && styles.filterPillActive,
          ]}
        >
          <Text
            style={[
              styles.filterPillText,
              !activeZoneFilter && { color: colors.primary },
            ]}
          >
            All
          </Text>
        </Pressable>
        {zones.map((z) => (
          <Pressable
            key={z.id}
            onPress={() =>
              setActiveZoneFilter(activeZoneFilter === z.id ? null : z.id)
            }
            style={[
              styles.filterPill,
              activeZoneFilter === z.id && {
                borderColor: z.color,
                backgroundColor: z.color + "1A",
              },
            ]}
          >
            <Text
              style={[
                styles.filterPillText,
                activeZoneFilter === z.id && { color: z.color },
              ]}
            >
              {zoneEmojis[z.name] || "·"} {z.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Task list */}
      {loading ? (
        <View style={{ padding: spacing.lg }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={load}
              tintColor={colors.primary}
            />
          }
          testID="task-list-container"
        >
          {filteredTasks.length === 0 && (
            <View style={styles.emptyState}>
              {/* Orbit rings illustration */}
              <View style={styles.orbitRings}>
                <View style={[styles.orbitRing, { width: 120, height: 120 }]} />
                <View style={[styles.orbitRing, { width: 80, height: 80 }]} />
                <View style={[styles.orbitRing, { width: 40, height: 40 }]} />
              </View>
              <Text style={styles.emptyTitle}>Your orbit is clear</Text>
              <Text style={styles.emptySub}>
                Tap the + button to add something to your orbit.
              </Text>
            </View>
          )}

          {filteredTasks.map((t) => {
            const zone = t.zone_id ? zoneMap.get(t.zone_id) : null;
            const zoneColor = zone?.color || colors.textMuted;
            const emotionData = emotionEmojis.find(
              (e) => e.key === t.emotion
            );

            return (
              <SwipeableTask
                key={t.id}
                onComplete={() => toggleComplete(t)}
                onDelete={() => removeTask(t)}
              >
              <GlassCard
                style={[
                  styles.taskCard,
                  t.completed && { opacity: 0.4 },
                ]}
                testID={`task-card-${t.id}`}
              >
                {/* Colored left edge */}
                <View
                  style={[styles.taskEdge, { backgroundColor: zoneColor }]}
                />

                <Pressable
                  onPress={() => toggleComplete(t)}
                  style={styles.checkBox}
                  testID={`task-toggle-${t.id}`}
                >
                  <View
                    style={[
                      styles.checkCircle,
                      t.completed && {
                        backgroundColor: colors.success,
                        borderColor: colors.success,
                      },
                    ]}
                  >
                    {t.completed && (
                      <Ionicons name="checkmark" size={14} color="#050508" />
                    )}
                  </View>
                </Pressable>

                <Pressable style={{ flex: 1 }} onPress={() => openEdit(t)}>
                  <Text
                    style={[
                      styles.taskTitle,
                      t.completed && { textDecorationLine: "line-through" },
                    ]}
                  >
                    {t.title}
                  </Text>

                  {/* Emotion tag */}
                  {emotionData && (
                    <Text style={styles.emotionTag}>{emotionData.emoji} {emotionData.label}</Text>
                  )}

                  <View style={styles.metaRow}>
                    {zone && (
                      <View
                        style={[
                          styles.zonePill,
                          { backgroundColor: zoneColor + "1A", borderColor: zoneColor + "33" },
                        ]}
                      >
                        <Text style={[styles.zonePillText, { color: zoneColor }]}>
                          {zone.name}
                        </Text>
                      </View>
                    )}
                    {t.due_date && (
                      <View style={styles.dueRow}>
                        <Ionicons
                          name="calendar-outline"
                          size={11}
                          color={colors.textDim}
                        />
                        <Text style={styles.dueText}>
                          {new Date(t.due_date).toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                    {t.recurrence && (
                      <View style={styles.dueRow}>
                        <Ionicons name="repeat" size={11} color={colors.primary} />
                        <Text style={[styles.dueText, { color: colors.primary }]}>
                          {RECURRENCE_LABELS[t.recurrence]}
                        </Text>
                      </View>
                    )}
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => removeTask(t)}
                  hitSlop={10}
                  testID={`task-delete-${t.id}`}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={colors.textMuted}
                  />
                </Pressable>
              </GlassCard>
              </SwipeableTask>
            );
          })}
        </ScrollView>
      )}

      {/* Floating + button */}
      <Pressable
        style={styles.fab}
        onPress={openAdd}
        testID="add-task-button"
      >
        <Ionicons name="add" size={28} color="#050508" />
      </Pressable>

      <TaskModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        zones={zones}
        editing={editing}
        onSaved={() => {
          setShowAdd(false);
          load();
        }}
      />
      <UpgradeModal
        visible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        reason="Free plan is capped at 15 open tasks. Go Pro for unlimited."
      />
    </SafeAreaView>
  );
}

function TaskModal({
  visible,
  onClose,
  zones,
  editing,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  zones: Zone[];
  editing: Task | null;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [urgency, setUrgency] = useState<"low" | "med" | "high">("med");
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string>("");
  const [emotion, setEmotion] = useState<string>("neutral");
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setNotes(editing.notes || "");
      setUrgency(editing.urgency);
      setZoneId(editing.zone_id);
      setDueDate(editing.due_date ? editing.due_date.slice(0, 10) : "");
      setEmotion(editing.emotion || "neutral");
      setRecurrence(editing.recurrence ?? null);
      setIsUrgent(editing.urgency === "high");
    } else if (visible) {
      setTitle("");
      setNotes("");
      setUrgency("med");
      setZoneId(zones[0]?.id || null);
      setDueDate("");
      setEmotion("neutral");
      setRecurrence(null);
      setIsUrgent(false);
    }
  }, [editing, visible, zones]);

  const save = async () => {
    if (!user || !title.trim()) return;
    setSaving(true);
    const TAG = "[Task Save]";

    const finalUrgency = isUrgent ? "high" : urgency;

    // Core payload — only columns that exist in the tasks table schema:
    //   id, user_id, zone_id, title, urgency, due_date, notes,
    //   completed, completed_at, created_at
    // NOTE: "emotion" column does NOT exist in the base schema.
    //       We attempt to include it; if Supabase rejects it we retry without.
    const corePayload: any = {
      title: title.trim(),
      urgency: finalUrgency,
      zone_id: zoneId,
      notes: notes.trim() || null,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      recurrence,
    };

    // Try with emotion first (in case user ran the ALTER TABLE)
    const fullPayload = { ...corePayload, emotion };

    console.log(TAG, "user:", user.id);
    console.log(TAG, "editing:", editing?.id ?? "new task");
    console.log(TAG, "payload:", JSON.stringify(fullPayload, null, 2));

    try {
      if (editing) {
        // ── UPDATE existing task ──
        let { error } = await supabase.from("tasks").update(fullPayload).eq("id", editing.id);
        if (error) {
          console.warn(TAG, "UPDATE with emotion failed:", error.code, error.message, "— retrying without emotion");
          ({ error } = await supabase.from("tasks").update(corePayload).eq("id", editing.id));
        }
        if (error) {
          console.error(TAG, "UPDATE failed:", error.code, error.message, error.details, error.hint);
        } else {
          console.log(TAG, "UPDATE success for task:", editing.id);
        }
      } else {
        // ── INSERT new task ──
        const insertPayload = { ...fullPayload, user_id: user.id };
        console.log(TAG, "INSERT payload:", JSON.stringify(insertPayload, null, 2));

        let { data, error } = await supabase.from("tasks").insert(insertPayload).select();
        if (error) {
          console.warn(TAG, "INSERT with emotion failed:", error.code, error.message, "— retrying without emotion");
          ({ data, error } = await supabase.from("tasks").insert({ ...corePayload, user_id: user.id }).select());
        }
        if (error) {
          console.error(TAG, "INSERT failed:", error.code, error.message, error.details, error.hint);
        } else {
          console.log(TAG, "INSERT success:", data);
        }
      }
    } catch (e: any) {
      console.error(TAG, "exception:", e?.message);
    }

    setSaving(false);
    onSaved();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ width: "100%" }}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.lg }}>
              <Text style={[styles.h1, { flex: 1 }]}>
                {editing ? "Edit task" : "New task"}
              </Text>
              <Pressable onPress={onClose} hitSlop={10} testID="task-modal-close">
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                testID="task-title-input"
                value={title}
                onChangeText={setTitle}
                placeholder="What's on your mind?"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />

              <Text style={styles.label}>Zone</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {zones.map((z) => (
                    <Pressable
                      key={z.id}
                      onPress={() => setZoneId(z.id)}
                      testID={`modal-zone-${z.name}`}
                      style={[
                        styles.chip,
                        {
                          borderColor: zoneId === z.id ? z.color : colors.glassBorder,
                          backgroundColor: zoneId === z.id ? z.color + "22" : colors.glassBg,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: zoneId === z.id ? z.color : colors.textDim,
                          fontFamily: fonts.bodyMed,
                          fontSize: 12,
                        }}
                      >
                        {zoneEmojis[z.name] || ""} {z.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.label}>Due date (YYYY-MM-DD, optional)</Text>
              <TextInput
                testID="task-due-input"
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="2026-06-15"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                autoCapitalize="none"
              />

              <Text style={styles.label}>Repeat</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {([null, "daily", "weekly", "monthly"] as (Recurrence | null)[]).map(
                  (r) => {
                    const active = recurrence === r;
                    return (
                      <Pressable
                        key={r ?? "none"}
                        onPress={() => setRecurrence(r)}
                        testID={`task-recurrence-${r ?? "none"}`}
                        style={[
                          styles.chip,
                          {
                            borderColor: active ? colors.primary : colors.glassBorder,
                            backgroundColor: active
                              ? colors.primary + "22"
                              : colors.glassBg,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: active ? colors.primary : colors.textDim,
                            fontFamily: fonts.bodyMed,
                            fontSize: 12,
                          }}
                        >
                          {r ? RECURRENCE_LABELS[r] : "None"}
                        </Text>
                      </Pressable>
                    );
                  }
                )}
              </View>

              <Text style={styles.label}>How does this feel?</Text>
              <View style={styles.emotionRow}>
                {emotionEmojis.map((e) => (
                  <Pressable
                    key={e.key}
                    onPress={() => setEmotion(e.key)}
                    style={[
                      styles.emotionBtn,
                      emotion === e.key && styles.emotionBtnActive,
                    ]}
                  >
                    <Text style={{ fontSize: 22 }}>{e.emoji}</Text>
                    <Text
                      style={[
                        styles.emotionBtnLabel,
                        emotion === e.key && { color: colors.primary },
                      ]}
                    >
                      {e.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Priority toggle */}
              <Pressable
                onPress={() => setIsUrgent(!isUrgent)}
                style={[
                  styles.urgentToggle,
                  isUrgent && {
                    borderColor: colors.danger + "66",
                    backgroundColor: colors.danger + "1A",
                    shadowColor: colors.danger,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                  },
                ]}
              >
                <Ionicons
                  name={isUrgent ? "flame" : "flame-outline"}
                  size={18}
                  color={isUrgent ? colors.danger : colors.textDim}
                />
                <Text
                  style={[
                    styles.urgentLabel,
                    isUrgent && { color: colors.danger },
                  ]}
                >
                  {isUrgent ? "Urgent" : "Mark as urgent"}
                </Text>
              </Pressable>

              <PrimaryButton
                title={editing ? "Save changes" : "Add to orbit"}
                onPress={save}
                loading={saving}
                testID="task-save-button"
                style={{ marginTop: spacing.lg }}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.button,
    backgroundColor: colors.glassBg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  filterRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: 8,
    flexDirection: "row",
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
  },
  filterPillActive: {
    borderColor: colors.primary + "55",
    backgroundColor: colors.primary + "1A",
  },
  filterPillText: {
    color: colors.textDim,
    fontFamily: fonts.bodyMed,
    fontSize: 13,
  },
  // Empty state
  emptyState: { alignItems: "center", paddingTop: 60 },
  orbitRings: {
    alignItems: "center",
    justifyContent: "center",
    width: 140,
    height: 140,
    marginBottom: 24,
  },
  orbitRing: {
    position: "absolute",
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 20,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  emptySub: {
    color: colors.textDim,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  swipeBg: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: "center",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    borderRadius: radius.card,
  },
  // Task cards
  taskCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    overflow: "hidden",
  },
  taskEdge: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: radius.card,
    borderBottomLeftRadius: radius.card,
  },
  checkBox: { marginTop: 2, marginLeft: 4 },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  taskTitle: {
    color: colors.text,
    fontFamily: fonts.bodyMed,
    fontSize: 15,
    letterSpacing: -0.3,
  },
  emotionTag: {
    color: colors.textDim,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 4,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  zonePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 1,
  },
  zonePillText: {
    fontFamily: fonts.bodyMed,
    fontSize: 11,
  },
  dueRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  dueText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 11 },
  // FAB
  fab: {
    position: "absolute",
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  // Modal
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    borderTopWidth: 1,
    borderColor: colors.glassBorderStrong,
    maxHeight: "85%",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textDim,
    fontFamily: fonts.bodyMed,
    fontSize: 12,
    marginTop: spacing.md,
    marginBottom: 6,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
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
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9999,
    borderWidth: 1,
  },
  emotionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  emotionBtn: {
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: "transparent",
    flex: 1,
  },
  emotionBtnActive: {
    borderColor: colors.primary + "44",
    backgroundColor: colors.primary + "0D",
  },
  emotionBtnLabel: {
    color: colors.textDim,
    fontFamily: fonts.body,
    fontSize: 9,
  },
  urgentToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    marginTop: spacing.md,
  },
  urgentLabel: {
    color: colors.textDim,
    fontFamily: fonts.bodyMed,
    fontSize: 13,
  },
});
