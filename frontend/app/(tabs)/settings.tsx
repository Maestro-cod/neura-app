import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  Platform,
  TextInput,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { LinearGradient } from "expo-linear-gradient";

import { colors, fonts, radius, spacing } from "@/src/theme";
import { GlassCard } from "@/src/components/GlassCard";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { UpgradeModal } from "@/src/components/UpgradeModal";
import { useAuth } from "@/src/context/AuthContext";
import { supabase } from "@/src/lib/supabase";
import { api } from "@/src/lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  requestNotificationPermission,
  syncTaskReminders,
  clearAllReminders,
} from "@/src/lib/notifications";

const REMINDERS_PREF_KEY = "neura.reminders.enabled";

export default function Settings() {
  const router = useRouter();
  const { user, profile, signOut, reloadProfile } = useAuth();
  const [name, setName] = useState(profile?.name || "");
  const [savingName, setSavingName] = useState(false);
  const [upgrade, setUpgrade] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<
    { id: string; member_email: string; status: string }[]
  >([]);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [familyBusy, setFamilyBusy] = useState(false);

  useEffect(() => {
    if (profile?.name && !name) {
      setName(profile.name);
    }
  }, [profile?.name]);

  const syncReminders = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tasks")
      .select("title, due_date")
      .eq("user_id", user.id)
      .eq("completed", false);
    await syncTaskReminders((data as any) || []);
  };

  // Restore the saved preference and keep reminders fresh on open (native only).
  useEffect(() => {
    if (Platform.OS === "web" || !user) return;
    AsyncStorage.getItem(REMINDERS_PREF_KEY).then((pref) => {
      if (pref === "true") {
        setNotifications(true);
        syncReminders();
      }
    });
  }, [user]);

  const toggleNotifications = async (value: boolean) => {
    if (Platform.OS === "web") {
      setNotifications(value);
      return;
    }
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          "Notifications blocked",
          "Allow notifications for NEURA in your device settings to get task reminders."
        );
        return;
      }
      await syncReminders();
      setNotifications(true);
      await AsyncStorage.setItem(REMINDERS_PREF_KEY, "true");
    } else {
      await clearAllReminders();
      setNotifications(false);
      await AsyncStorage.setItem(REMINDERS_PREF_KEY, "false");
    }
  };

  const loadFamily = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("family_members")
      .select("id, member_email, status")
      .eq("owner_id", user.id)
      .neq("status", "removed")
      .order("created_at", { ascending: true });
    setFamilyMembers((data as any) || []);
  };

  useEffect(() => {
    if (profile?.plan === "family") loadFamily();
  }, [profile?.plan, user]);

  const addMember = async () => {
    const email = newMemberEmail.trim().toLowerCase();
    if (!user || !email) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      Alert.alert("Invalid email", "Enter a valid email address.");
      return;
    }
    setFamilyBusy(true);
    const { error } = await supabase
      .from("family_members")
      .insert({ owner_id: user.id, member_email: email });
    if (error) {
      Alert.alert("Couldn't add member", error.message);
    } else {
      setNewMemberEmail("");
      await loadFamily();
    }
    setFamilyBusy(false);
  };

  const removeMember = async (id: string) => {
    setFamilyMembers((cur) => cur.filter((m) => m.id !== id));
    await supabase.from("family_members").delete().eq("id", id);
  };

  const saveName = async () => {
    if (!user) return;
    setSavingName(true);
    await supabase.from("profiles").update({ name: name.trim() }).eq("id", user.id);
    await reloadProfile();
    setSavingName(false);
  };

  const openPortal = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { portal_url } = await api.openPortal({
        user_id: user.id,
        return_url:
          Platform.OS === "web"
            ? window.location.origin
            : (process.env.EXPO_PUBLIC_API_URL as string),
      });
      if (Platform.OS === "web") {
        // @ts-ignore
        window.location.assign(portal_url);
      } else {
        await WebBrowser.openBrowserAsync(portal_url);
      }
      await reloadProfile();
    } catch (e: any) {
      Alert.alert("Couldn't open portal", e?.message || "Try again");
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await api.deleteAccount(user.id);
    } catch (e) {
      // ignore — proceed to sign out
    }
    await signOut();
    router.replace("/auth/login");
  };

  const confirmDelete = () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "Delete account?\n\nThis permanently removes your profile, tasks, zones, and cancels any active subscription. This cannot be undone."
      );
      if (confirmed) doDelete();
    } else {
      Alert.alert(
        "Delete account?",
        "This permanently removes your profile, tasks, zones, and cancels any active subscription. This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete forever", style: "destructive", onPress: doDelete },
        ]
      );
    }
  };

  const isPro = profile?.plan === "pro" || profile?.plan === "family";
  const isFamily = profile?.plan === "family";
  const planLabel = isPro ? (profile?.plan === "family" ? "Family" : "PRO") : "Free";

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.h1}>Settings</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.lg }}
      >
        {/* Profile Card */}
        <GlassCard strong testID="settings-profile-section" style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatarWrap}>
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                style={styles.avatarGradient}
              >
                <Text style={styles.avatarText}>
                  {(profile?.name || "?").charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.profileName}>
                  {profile?.name || "Explorer"}
                </Text>
                {isPro && (
                  <View style={styles.proBadge}>
                    <Text style={styles.proBadgeText}>✦ {planLabel}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.profileEmail}>
                {profile?.email || user?.email || "—"}
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* Account Section */}
        <GlassCard strong>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <Text style={styles.label}>Name</Text>
          <View style={styles.row}>
            <TextInput
              testID="settings-name-input"
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { flex: 1 }]}
            />
            <Pressable
              onPress={saveName}
              disabled={savingName || !name.trim() || name === profile?.name}
              style={[
                styles.saveBtn,
                {
                  opacity:
                    savingName || !name.trim() || name === profile?.name
                      ? 0.4
                      : 1,
                },
              ]}
              testID="settings-name-save"
            >
              <Text style={styles.saveTxt}>Save</Text>
            </Pressable>
          </View>
          <Text style={styles.label}>Timezone</Text>
          <View style={styles.tzRow}>
            <Ionicons name="globe-outline" size={14} color={colors.textDim} />
            <Text style={styles.value}>{profile?.timezone || "UTC"}</Text>
          </View>
        </GlassCard>

        {/* Subscription Section */}
        <GlassCard
          strong
          style={[
            styles.subCard,
            isPro && {
              borderColor: colors.secondary + "44",
              shadowColor: colors.secondary,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.2,
              shadowRadius: 20,
            },
          ]}
        >
          <Text style={styles.sectionLabel}>SUBSCRIPTION</Text>
          <View style={styles.planRow}>
            <View>
              <Text style={styles.planTitle}>{planLabel}</Text>
              <Text style={styles.planPrice}>
                {isPro ? "€9/mo" : "Free"}
              </Text>
            </View>
            {isPro && (
              <View style={[styles.planActiveBadge]}>
                <View style={styles.planActiveDot} />
                <Text style={styles.planActiveText}>Active</Text>
              </View>
            )}
          </View>
          {isPro ? (
            <SecondaryButton
              title="Manage Billing"
              onPress={openPortal}
              testID="settings-manage-subscription"
              style={{ marginTop: spacing.md }}
            />
          ) : (
            <PrimaryButton
              title="Upgrade to PRO"
              onPress={() => setUpgrade(true)}
              testID="settings-manage-subscription"
              style={{ marginTop: spacing.md }}
            />
          )}
        </GlassCard>

        {/* Family Section */}
        <GlassCard strong testID="settings-family-section">
          <Text style={styles.sectionLabel}>FAMILY</Text>
          {isFamily ? (
            <>
              <Text style={styles.familyHint}>
                Invite people to share your NEURA family plan.
              </Text>
              <View style={[styles.row, { marginTop: spacing.sm }]}>
                <TextInput
                  testID="family-email-input"
                  value={newMemberEmail}
                  onChangeText={setNewMemberEmail}
                  placeholder="member@email.com"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[styles.input, { flex: 1 }]}
                />
                <Pressable
                  onPress={addMember}
                  disabled={familyBusy || !newMemberEmail.trim()}
                  style={[
                    styles.saveBtn,
                    { opacity: familyBusy || !newMemberEmail.trim() ? 0.4 : 1 },
                  ]}
                  testID="family-add-button"
                >
                  <Text style={styles.saveTxt}>Invite</Text>
                </Pressable>
              </View>
              {familyMembers.length === 0 ? (
                <Text style={[styles.familyHint, { marginTop: spacing.md }]}>
                  No members yet.
                </Text>
              ) : (
                familyMembers.map((m) => (
                  <View key={m.id} style={styles.memberRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberEmail}>{m.member_email}</Text>
                      <Text style={styles.memberStatus}>{m.status}</Text>
                    </View>
                    <Pressable
                      onPress={() => removeMember(m.id)}
                      hitSlop={10}
                      testID={`family-remove-${m.id}`}
                    >
                      <Ionicons
                        name="close-circle-outline"
                        size={20}
                        color={colors.textMuted}
                      />
                    </Pressable>
                  </View>
                ))
              )}
            </>
          ) : (
            <>
              <Text style={styles.familyHint}>
                Share NEURA with your household. Available on the Family plan.
              </Text>
              <PrimaryButton
                title="Upgrade to Family"
                onPress={() => setUpgrade(true)}
                style={{ marginTop: spacing.md }}
                testID="family-upgrade"
              />
            </>
          )}
        </GlassCard>

        {/* App Section */}
        <GlassCard>
          <Text style={styles.sectionLabel}>APP</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications-outline" size={18} color={colors.textDim} />
              <Text style={styles.settingLabel}>Notifications</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={toggleNotifications}
              trackColor={{ false: "rgba(255,255,255,0.1)", true: colors.primary + "55" }}
              thumbColor={notifications ? colors.primary : "rgba(255,255,255,0.3)"}
            />
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="moon-outline" size={18} color={colors.textDim} />
              <Text style={styles.settingLabel}>Theme</Text>
            </View>
            <View style={styles.themeBadge}>
              <Text style={styles.themeBadgeText}>Dark</Text>
              <Ionicons name="lock-closed" size={10} color={colors.textMuted} />
            </View>
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textDim} />
              <Text style={styles.settingLabel}>Version</Text>
            </View>
            <Text style={styles.versionText}>NEURA v1.0</Text>
          </View>
        </GlassCard>

        {/* Legal Section */}
        <GlassCard>
          <Text style={styles.sectionLabel}>LEGAL</Text>
          <Pressable
            onPress={() => Linking.openURL("https://neura.app/privacy")}
            style={styles.linkRow}
            testID="settings-privacy"
          >
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.textDim} />
            <Text style={styles.linkLabel}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL("https://neura.app/terms")}
            style={styles.linkRow}
            testID="settings-terms"
          >
            <Ionicons name="document-text-outline" size={18} color={colors.textDim} />
            <Text style={styles.linkLabel}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        </GlassCard>

        {/* Danger Zone */}
        <GlassCard style={styles.dangerCard}>
          <Text style={[styles.sectionLabel, { color: colors.danger }]}>DANGER ZONE</Text>
          <Pressable
            onPress={async () => {
              await signOut();
              router.replace("/auth/login");
            }}
            style={styles.dangerBtn}
            testID="settings-sign-out-button"
          >
            <Ionicons name="log-out-outline" size={18} color={colors.text} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
          <Pressable
            onPress={confirmDelete}
            style={[styles.dangerBtn, styles.deleteBtn]}
            testID="settings-delete-account"
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={styles.deleteTxt}>Delete account permanently</Text>
          </Pressable>
        </GlassCard>
      </ScrollView>

      <UpgradeModal visible={upgrade} onClose={() => setUpgrade(false)} />
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
  // Profile card
  profileCard: { paddingVertical: 20 },
  profileTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
  },
  avatarGradient: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontFamily: fonts.headingBlack,
    fontSize: 24,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  profileName: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 18,
    letterSpacing: -0.5,
  },
  proBadge: {
    backgroundColor: colors.primary + "22",
    borderColor: colors.primary + "55",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  proBadgeText: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  profileEmail: {
    color: colors.textDim,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  // Sections
  sectionLabel: {
    color: colors.textDim,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textDim,
    fontFamily: fonts.bodyMed,
    fontSize: 11,
    marginTop: spacing.md,
    marginBottom: 6,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  value: { color: colors.text, fontFamily: fonts.body, fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  tzRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  input: {
    backgroundColor: colors.glassBg,
    borderColor: colors.glassBorderStrong,
    borderWidth: 1,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.button,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  saveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  saveTxt: { color: "#050508", fontFamily: fonts.bodyBold, fontSize: 13 },
  // Family
  familyHint: {
    color: colors.textDim,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  memberEmail: { color: colors.text, fontFamily: fonts.body, fontSize: 14 },
  memberStatus: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 2,
    textTransform: "capitalize",
  },
  // Subscription
  subCard: {},
  planRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  planTitle: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 24,
    letterSpacing: -0.5,
  },
  planPrice: {
    color: colors.textDim,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  planActiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: colors.success + "1A",
  },
  planActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  planActiveText: {
    color: colors.success,
    fontFamily: fonts.bodyMed,
    fontSize: 11,
  },
  // App settings
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  settingInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  settingLabel: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  themeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    backgroundColor: colors.glassBg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  themeBadgeText: {
    color: colors.textDim,
    fontFamily: fonts.bodyMed,
    fontSize: 11,
  },
  versionText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  // Legal
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  linkLabel: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    flex: 1,
  },
  // Danger zone
  dangerCard: {
    borderColor: colors.danger + "33",
    borderWidth: 1,
  },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
    backgroundColor: colors.glassBg,
    marginBottom: spacing.sm,
  },
  signOutText: {
    color: colors.text,
    fontFamily: fonts.bodyMed,
    fontSize: 14,
  },
  deleteBtn: {
    borderColor: colors.danger + "44",
    backgroundColor: colors.danger + "0D",
  },
  deleteTxt: {
    color: colors.danger,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
});
