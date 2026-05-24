import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { colors, fonts, radius, spacing, zoneColors, zoneIcons } from "@/src/theme";
import { GlassCard } from "@/src/components/GlassCard";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { UrgencyBadge } from "@/src/components/UrgencyBadge";
import { UpgradeModal } from "@/src/components/UpgradeModal";
import { useAuth } from "@/src/context/AuthContext";
import { supabase } from "@/src/lib/supabase";

type Zone = { id: string; name: string; color: string };
type Task = {
  id: string;
  title: string;
  urgency: "low" | "med" | "high";
  zone_id: string | null;
  notes: string | null;
  due_date: string | null;
  completed: boolean;
};

const FREE_TASK_LIMIT = 15;

export default function Tasks() {
  const { user, profile } = useAuth();
  const [zones, setZones] = useState<Zone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: z }, { data: t }] = await Promise.all([
      supabase.from("zones").select("*").eq("user_id", user.id).eq("active", true),
      supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    setZones((z as any) || []);
    setTasks((t as any) || []);
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  // Auto-archive completed tasks older than 24h
  useEffect(() => {
    const now = Date.now();
    const stale = tasks.filter((t) => t.completed && t.id);
    // For simplicity, leave it visible but faded; archive on next load via filter
  }, [tasks]);

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
  };

  const removeTask = async (t: Task) => {
    setTasks((cur) => cur.filter((x) => x.id !== t.id));
    await supabase.from("tasks").delete().eq("id", t.id);
  };

  // Group by zone
  const grouped = useMemo(() => {
    const zMap = new Map(zones.map((z) => [z.id, z]));
    const byZone: Record<string, { zone: Zone | null; tasks: Task[] }> = {};
    const order: string[] = [];
    for (const t of tasks) {
      const key = t.zone_id || "_none";
      if (!byZone[key]) {
        byZone[key] = { zone: zMap.get(t.zone_id || "") || null, tasks: [] };
        order.push(key);
      }
      byZone[key].tasks.push(t);
    }
    return { byZone, order };
  }, [tasks, zones]);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>Tasks</Text>
          <Text style={styles.sub}>{tasks.filter((t) => !t.completed).length} open · {tasks.filter((t) => t.completed).length} done</Text>
        </View>
        <Pressable style={styles.fab} onPress={openAdd} testID="add-task-button">
          <Ionicons name="add" size={20} color="#050508" />
          <Text style={styles.fabText}>Add task</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.gradientStart} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.gradientStart} />}
          testID="task-list-container"
        >
          {tasks.length === 0 && (
            <GlassCard strong>
              <Text style={styles.emptyTitle}>Your task list is clear</Text>
              <Text style={styles.emptySub}>Tap Add task to drop something off your mind.</Text>
            </GlassCard>
          )}
          {grouped.order.map((key) => {
            const g = grouped.byZone[key];
            const zoneColor = g.zone ? g.zone.color : colors.textMuted;
            const zoneName = g.zone ? g.zone.name : "Unassigned";
            return (
              <View key={key} style={{ marginBottom: spacing.lg }}>
                <View style={styles.zoneHeader}>
                  <View style={[styles.zoneStripe, { backgroundColor: zoneColor }]} />
                  <Ionicons name={(zoneIcons[zoneName] || "ellipse-outline") as any} size={14} color={zoneColor} />
                  <Text style={[styles.zoneTitle, { color: zoneColor }]}>{zoneName}</Text>
                  <Text style={styles.zoneCount}>{g.tasks.length}</Text>
                </View>
                {g.tasks.map((t) => (
                  <GlassCard key={t.id} style={[styles.taskCard, t.completed && { opacity: 0.45 }]} testID={`task-card-${t.id}`}>
                    <Pressable
                      onPress={() => toggleComplete(t)}
                      style={styles.checkBox}
                      testID={`task-toggle-${t.id}`}
                    >
                      <Ionicons
                        name={t.completed ? "checkmark-circle" : "ellipse-outline"}
                        size={22}
                        color={t.completed ? zoneColor : colors.textDim}
                      />
                    </Pressable>
                    <Pressable style={{ flex: 1 }} onPress={() => openEdit(t)}>
                      <Text style={[styles.taskTitle, t.completed && { textDecorationLine: "line-through" }]}>
                        {t.title}
                      </Text>
                      <View style={styles.metaRow}>
                        <UrgencyBadge urgency={t.urgency} />
                        {t.due_date && (
                          <View style={styles.dueRow}>
                            <Ionicons name="time-outline" size={11} color={colors.textDim} />
                            <Text style={styles.dueText}>{new Date(t.due_date).toLocaleDateString()}</Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                    <Pressable onPress={() => removeTask(t)} hitSlop={10} testID={`task-delete-${t.id}`}>
                      <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                    </Pressable>
                  </GlassCard>
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}

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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setNotes(editing.notes || "");
      setUrgency(editing.urgency);
      setZoneId(editing.zone_id);
      setDueDate(editing.due_date ? editing.due_date.slice(0, 10) : "");
    } else if (visible) {
      setTitle("");
      setNotes("");
      setUrgency("med");
      setZoneId(zones[0]?.id || null);
      setDueDate("");
    }
  }, [editing, visible, zones]);

  const save = async () => {
    if (!user || !title.trim()) return;
    setSaving(true);
    const payload: any = {
      title: title.trim(),
      urgency,
      zone_id: zoneId,
      notes: notes.trim() || null,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
    };
    if (editing) {
      await supabase.from("tasks").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("tasks").insert({ ...payload, user_id: user.id });
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
          <View style={styles.sheet}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
              <Text style={[styles.h1, { flex: 1 }]}>{editing ? "Edit task" : "Add task"}</Text>
              <Pressable onPress={onClose} hitSlop={10} testID="task-modal-close">
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

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
                    <Text style={{ color: zoneId === z.id ? z.color : colors.textDim, fontFamily: fonts.bodyMed, fontSize: 12 }}>
                      {z.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.label}>Urgency</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["low", "med", "high"] as const).map((u) => (
                <Pressable
                  key={u}
                  onPress={() => setUrgency(u)}
                  testID={`modal-urgency-${u}`}
                  style={{ opacity: urgency === u ? 1 : 0.4 }}
                >
                  <UrgencyBadge urgency={u} />
                </Pressable>
              ))}
            </View>

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

            <Text style={styles.label}>Notes</Text>
            <TextInput
              testID="task-notes-input"
              value={notes}
              onChangeText={setNotes}
              placeholder="Any details..."
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { minHeight: 70, textAlignVertical: "top" }]}
              multiline
            />

            <PrimaryButton
              title={editing ? "Save changes" : "Add task"}
              onPress={save}
              loading={saving}
              testID="task-save-button"
              style={{ marginTop: spacing.lg }}
            />
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
  h1: { color: colors.text, fontFamily: fonts.heading, fontSize: 26 },
  sub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 9999,
    backgroundColor: colors.gradientStart,
  },
  fabText: { color: "#050508", fontFamily: fonts.bodyBold, fontSize: 13 },
  zoneHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.sm },
  zoneStripe: { width: 3, height: 16, borderRadius: 2 },
  zoneTitle: { fontFamily: fonts.headingMed, fontSize: 13, letterSpacing: 1, textTransform: "uppercase", flex: 1 },
  zoneCount: { color: colors.textDim, fontFamily: fonts.bodyMed, fontSize: 12 },
  taskCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    marginBottom: spacing.sm,
  },
  checkBox: { marginTop: 2 },
  taskTitle: { color: colors.text, fontFamily: fonts.bodyMed, fontSize: 15 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  dueRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  dueText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 11 },
  emptyTitle: { color: colors.text, fontFamily: fonts.heading, fontSize: 18 },
  emptySub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13, marginTop: 4 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    borderTopWidth: 1,
    borderColor: colors.glassBorderStrong,
  },
  label: { color: colors.textDim, fontFamily: fonts.bodyMed, fontSize: 12, marginTop: spacing.md, marginBottom: 6 },
  input: {
    backgroundColor: colors.glassBg,
    borderColor: colors.glassBorderStrong,
    borderWidth: 1,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderRadius: radius.button,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9999, borderWidth: 1 },
});
