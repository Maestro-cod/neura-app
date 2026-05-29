import React, { useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Platform, Linking, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { GlassCard } from "@/src/components/GlassCard";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/lib/api";

type Plan = {
  id: "free" | "pro" | "family";
  name: string;
  price: string;
  features: string[];
  cta: string;
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "€0",
    features: ["3 life zones", "15 tasks max", "Basic reminders"],
    cta: "Current plan",
  },
  {
    id: "pro",
    name: "Pro",
    price: "€9 / month",
    features: ["All 6 life zones", "Unlimited tasks", "AI assistant (Claude)", "30-day stress forecast"],
    cta: "Upgrade to Pro",
  },
  {
    id: "family",
    name: "Family",
    price: "€15 / month",
    features: ["Everything in Pro", "Up to 5 family members", "Shared zones", "Priority support"],
    cta: "Upgrade to Family",
  },
];

export function UpgradeModal({
  visible,
  onClose,
  reason,
}: {
  visible: boolean;
  onClose: () => void;
  reason?: string;
}) {
  const { user, profile, reloadProfile } = useAuth();
  const [loading, setLoading] = useState<"pro" | "family" | null>(null);

  const startCheckout = async (plan: "pro" | "family") => {
    if (!user || !profile) return;
    setLoading(plan);
    try {
      const backend = (process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_BACKEND_URL) as string;
      const success = `${backend}/billing-success?session_id={CHECKOUT_SESSION_ID}`;
      const cancel = `${backend}/billing-cancel`;
      const { checkout_url, session_id } = await api.createCheckoutSession({
        user_id: user.id,
        email: user.email || profile.email || "",
        plan,
        success_url: success,
        cancel_url: cancel,
      });
      if (Platform.OS === "web") {
        // @ts-ignore
        window.location.assign(checkout_url);
      } else {
        await WebBrowser.openBrowserAsync(checkout_url);
        // After return, verify session and reload profile
        try {
          await api.verifySession({ user_id: user.id, session_id });
        } catch (e) {
          // ignore — webhook may also do it
        }
        await reloadProfile();
      }
    } catch (e: any) {
      console.warn("checkout error", e?.message ?? e);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} testID="upgrade-modal-title">
                Unlock NEURA Pro
              </Text>
              {reason && <Text style={styles.reason}>{reason}</Text>}
            </View>
            <Pressable onPress={onClose} testID="upgrade-modal-close" hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            {PLANS.map((p) => {
              const current = profile?.plan === p.id;
              const isPaid = p.id !== "free";
              return (
                <GlassCard key={p.id} style={styles.planCard} strong={p.id === "pro"} testID={`plan-${p.id}`}>
                  <View style={styles.planHeader}>
                    <Text style={styles.planName}>{p.name}</Text>
                    <Text style={styles.planPrice}>{p.price}</Text>
                  </View>
                  {p.features.map((f) => (
                    <View key={f} style={styles.featureRow}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.gradientStart} />
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                  {isPaid && !current && (
                    <PrimaryButton
                      title={p.cta}
                      loading={loading === p.id}
                      onPress={() => startCheckout(p.id as "pro" | "family")}
                      style={{ marginTop: 12 }}
                      testID={`checkout-${p.id}-button`}
                    />
                  )}
                  {current && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentText}>Current plan</Text>
                    </View>
                  )}
                </GlassCard>
              );
            })}
            <Text style={styles.terms}>
              Subscriptions auto-renew until cancelled. You can cancel anytime from Settings → Manage subscription. By
              continuing you agree to the{" "}
              <Text style={styles.link} onPress={() => Linking.openURL("https://neura.app/privacy")}>
                Privacy Policy
              </Text>{" "}
              and Terms.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    maxHeight: "90%",
    borderTopWidth: 1,
    borderColor: colors.glassBorderStrong,
  },
  header: { flexDirection: "row", alignItems: "flex-start", marginBottom: spacing.md },
  title: { color: colors.text, fontFamily: fonts.heading, fontSize: 22 },
  reason: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13, marginTop: 4 },
  planCard: { marginBottom: spacing.md },
  planHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  planName: { color: colors.text, fontFamily: fonts.heading, fontSize: 18 },
  planPrice: { color: colors.gradientStart, fontFamily: fonts.bodyBold, fontSize: 14 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 3 },
  featureText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13 },
  currentBadge: { marginTop: 8, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, backgroundColor: colors.glassBgStrong },
  currentText: { color: colors.textDim, fontFamily: fonts.bodyMed, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 },
  terms: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 11, marginTop: 8, lineHeight: 16 },
  link: { color: colors.gradientEnd, textDecorationLine: "underline" },
});
