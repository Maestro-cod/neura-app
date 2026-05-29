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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import { colors, fonts, radius, spacing } from "@/src/theme";
import { GlassCard } from "@/src/components/GlassCard";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { UpgradeModal } from "@/src/components/UpgradeModal";
import { useAuth } from "@/src/context/AuthContext";
import { supabase } from "@/src/lib/supabase";
import { api } from "@/src/lib/api";

export default function Settings() {
  const router = useRouter();
  const { user, profile, signOut, reloadProfile } = useAuth();
  const [name, setName] = useState(profile?.name || "");
  const [savingName, setSavingName] = useState(false);
  const [upgrade, setUpgrade] = useState(false);
  const [busy, setBusy] = useState(false);

  // Sync name state when profile loads asynchronously
  useEffect(() => {
    if (profile?.name && !name) {
      setName(profile.name);
    }
  }, [profile?.name]);

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
        return_url: Platform.OS === "web" ? window.location.origin : (process.env.EXPO_PUBLIC_API_URL as string),
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
      // Alert.alert doesn't work on web — use window.confirm
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

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.h1}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100, gap: spacing.lg }}>
        {/* Profile */}
        <GlassCard strong testID="settings-profile-section">
          <Text style={styles.sectionLabel}>Profile</Text>
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
              style={[styles.saveBtn, { opacity: savingName || !name.trim() || name === profile?.name ? 0.4 : 1 }]}
              testID="settings-name-save"
            >
              <Text style={styles.saveTxt}>Save</Text>
            </Pressable>
          </View>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{profile?.email || user?.email || "—"}</Text>
          <Text style={styles.label}>Timezone</Text>
          <Text style={styles.value}>{profile?.timezone || "UTC"}</Text>
        </GlassCard>

        {/* Subscription */}
        <GlassCard strong>
          <Text style={styles.sectionLabel}>Subscription</Text>
          <View style={styles.planRow}>
            <View>
              <Text style={styles.value}>Current plan</Text>
              <Text style={styles.planName} testID="settings-current-plan">
                {(profile?.plan || "free").toUpperCase()}
              </Text>
            </View>
            <View style={[styles.planBadge, { borderColor: (!profile || profile.plan === "free") ? colors.glassBorderStrong : colors.gradientStart }]}>
              <Text style={{ color: (!profile || profile.plan === "free") ? colors.textDim : colors.gradientStart, fontFamily: fonts.bodyBold, fontSize: 11 }}>
                {(!profile || profile.plan === "free") ? "FREE" : profile.plan === "pro" ? "PRO · €9/mo" : "FAMILY · €15/mo"}
              </Text>
            </View>
          </View>

          {(!profile || profile.plan === "free") ? (
            <PrimaryButton
              title="Upgrade plan"
              onPress={() => setUpgrade(true)}
              style={{ marginTop: spacing.md }}
              testID="settings-upgrade-button"
            />
          ) : (
            <SecondaryButton
              title={busy ? "Opening..." : "Manage subscription"}
              onPress={openPortal}
              style={{ marginTop: spacing.md }}
              testID="settings-manage-subscription"
            />
          )}

          <Text style={styles.helpText}>
            Subscriptions renew automatically. Cancel anytime from your billing portal — your access stays active
            through the end of the current period.
          </Text>
        </GlassCard>

        {/* Legal */}
        <GlassCard>
          <Text style={styles.sectionLabel}>Legal</Text>
          <Pressable
            onPress={() => Linking.openURL("https://neura.app/privacy")}
            style={styles.linkRow}
            testID="settings-privacy"
          >
            <Ionicons name="document-text-outline" size={16} color={colors.textDim} />
            <Text style={styles.linkLabel}>Privacy policy</Text>
            <Ionicons name="open-outline" size={14} color={colors.textMuted} />
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL("https://neura.app/terms")}
            style={styles.linkRow}
            testID="settings-terms"
          >
            <Ionicons name="document-text-outline" size={16} color={colors.textDim} />
            <Text style={styles.linkLabel}>Terms of service</Text>
            <Ionicons name="open-outline" size={14} color={colors.textMuted} />
          </Pressable>
        </GlassCard>

        {/* Danger zone */}
        <GlassCard style={{ borderColor: "#ff6b6b33" }}>
          <Text style={[styles.sectionLabel, { color: "#ff6b6b" }]}>Account</Text>
          <SecondaryButton
            title="Sign out"
            onPress={async () => {
              await signOut();
              router.replace("/auth/login");
            }}
            testID="settings-sign-out-button"
            style={{ marginBottom: spacing.sm }}
          />
          <Pressable onPress={confirmDelete} style={styles.dangerBtn} testID="settings-delete-account">
            <Ionicons name="trash-outline" size={16} color="#ff6b6b" />
            <Text style={styles.dangerTxt}>Delete account permanently</Text>
          </Pressable>
        </GlassCard>

        <Text style={styles.footerText}>NEURA · v1.0</Text>
      </ScrollView>

      <UpgradeModal visible={upgrade} onClose={() => setUpgrade(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  h1: { color: colors.text, fontFamily: fonts.heading, fontSize: 26 },
  sectionLabel: { color: colors.textDim, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: spacing.sm },
  label: { color: colors.textDim, fontFamily: fonts.bodyMed, fontSize: 11, marginTop: spacing.md, marginBottom: 4 },
  value: { color: colors.text, fontFamily: fonts.body, fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  saveBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.button, backgroundColor: colors.gradientStart },
  saveTxt: { color: "#050508", fontFamily: fonts.bodyBold, fontSize: 13 },
  planRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  planName: { color: colors.text, fontFamily: fonts.heading, fontSize: 22, marginTop: 2 },
  planBadge: { borderWidth: 1, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 5 },
  helpText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 11, marginTop: spacing.md, lineHeight: 16 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  linkLabel: { color: colors.text, fontFamily: fonts.body, fontSize: 14, flex: 1 },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#ff6b6b55",
    borderRadius: radius.button,
    paddingVertical: 12,
  },
  dangerTxt: { color: "#ff6b6b", fontFamily: fonts.bodyBold, fontSize: 13 },
  footerText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 11, textAlign: "center", marginTop: spacing.md },
});
