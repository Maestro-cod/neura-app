import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { GlassCard } from "@/src/components/GlassCard";
import { GalaxyCanvas } from "@/src/components/GalaxyCanvas";
import { supabase } from "@/src/lib/supabase";

export default function Signup() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onSignup = async () => {
    setErr(null);
    setInfo(null);
    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    if (data.session) {
      router.replace("/");
    } else {
      setInfo("Account created. Please check your email to verify, then log in.");
    }
  };

  const onGoogle = async () => {
    setErr(null);
    // On web, redirect back to the app root after OAuth; on native, use the Expo auth proxy
    const redirectTo = Platform.OS === "web"
      ? window.location.origin
      : `${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/callback`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) setErr(error.message);
  };

  return (
    <View style={styles.root}>
      <GalaxyCanvas />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.brand}>
              <Text style={styles.brandTitle}>NEURA</Text>
              <Text style={styles.brandSub}>Quiet the noise. Map your mind.</Text>
            </View>

            <GlassCard strong>
              <Text style={styles.h2}>Create your account</Text>
              <Text style={styles.label}>Email</Text>
              <TextInput
                testID="signup-email-input"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              <Text style={styles.label}>Password</Text>
              <TextInput
                testID="signup-password-input"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="At least 6 characters"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              {err && <Text style={styles.err} testID="signup-error">{err}</Text>}
              {info && <Text style={styles.info} testID="signup-info">{info}</Text>}
              <PrimaryButton
                title="Create account"
                onPress={onSignup}
                loading={loading}
                testID="signup-submit-button"
                style={{ marginTop: spacing.md }}
              />
              <SecondaryButton
                title="Continue with Google"
                onPress={onGoogle}
                testID="google-oauth-button-signup"
                style={{ marginTop: spacing.sm }}
              />
            </GlassCard>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <Link href="/auth/login" asChild>
                <Pressable testID="go-to-login">
                  <Text style={styles.link}> Log in</Text>
                </Pressable>
              </Link>
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
  scroll: { padding: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xxl, gap: spacing.lg },
  brand: { alignItems: "center", marginBottom: spacing.lg },
  brandTitle: { color: colors.text, fontFamily: fonts.headingBlack, fontSize: 44, letterSpacing: 4 },
  brandSub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13, marginTop: 6 },
  h2: { color: colors.text, fontFamily: fonts.heading, fontSize: 20, marginBottom: spacing.md },
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
  },
  err: { color: "#ff6b6b", fontFamily: fonts.body, fontSize: 12, marginTop: 8 },
  info: { color: colors.gradientStart, fontFamily: fonts.body, fontSize: 12, marginTop: 8 },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  footerText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13 },
  link: { color: colors.gradientEnd, fontFamily: fonts.bodyBold, fontSize: 13 },
});
