import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { GlassCard } from "@/src/components/GlassCard";
import { GalaxyCanvas } from "@/src/components/GalaxyCanvas";
import { supabase } from "@/src/lib/supabase";

export default function Forgot() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onSend = async () => {
    setMsg(null);
    setErr(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: process.env.EXPO_PUBLIC_BACKEND_URL,
    });
    setLoading(false);
    if (error) setErr(error.message);
    else setMsg("If that email exists, a reset link was sent.");
  };

  return (
    <View style={styles.root}>
      <GalaxyCanvas />
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => router.back()} style={styles.back} testID="forgot-back">
            <Ionicons name="chevron-back" size={22} color={colors.text} />
            <Text style={styles.backTxt}>Back</Text>
          </Pressable>
          <Text style={styles.h1}>Reset password</Text>
          <Text style={styles.sub}>Enter the email tied to your NEURA account and we'll send a reset link.</Text>
          <GlassCard strong style={{ marginTop: spacing.lg }}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="forgot-email-input"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
            {err && <Text style={styles.err}>{err}</Text>}
            {msg && <Text style={styles.info} testID="forgot-info">{msg}</Text>}
            <PrimaryButton
              title="Send reset link"
              onPress={onSend}
              loading={loading}
              testID="forgot-submit-button"
              style={{ marginTop: spacing.md }}
            />
          </GlassCard>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  scroll: { padding: spacing.lg, paddingTop: spacing.xl, gap: spacing.sm },
  back: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  backTxt: { color: colors.text, fontFamily: fonts.bodyMed, fontSize: 14 },
  h1: { color: colors.text, fontFamily: fonts.heading, fontSize: 28 },
  sub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 14, marginTop: 4 },
  label: { color: colors.textDim, fontFamily: fonts.bodyMed, fontSize: 12, marginBottom: 4 },
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
  err: { color: "#ff6b6b", fontFamily: fonts.body, fontSize: 12, marginTop: 8 },
  info: { color: colors.gradientStart, fontFamily: fonts.body, fontSize: 12, marginTop: 8 },
});
