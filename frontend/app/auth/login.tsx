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
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { GlassCard } from "@/src/components/GlassCard";
import { GalaxyCanvas } from "@/src/components/GalaxyCanvas";
import { supabase } from "@/src/lib/supabase";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onLogin = async () => {
    setErr(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.replace("/");
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.brand}>
              <Text style={styles.brandTitle} testID="login-title">NEURA</Text>
              <Text style={styles.brandSub}>Manage your mental load. Across galaxies.</Text>
            </View>

            <GlassCard style={styles.card} strong>
              <Text style={styles.h2}>Welcome back</Text>
              <Text style={styles.label}>Email</Text>
              <TextInput
                testID="login-email-input"
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
                testID="login-password-input"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              {err && (
                <Text testID="login-error" style={styles.err}>
                  {err}
                </Text>
              )}
              <PrimaryButton
                title="Log in"
                onPress={onLogin}
                loading={loading}
                testID="login-submit-button"
                style={{ marginTop: spacing.md }}
              />
              <SecondaryButton
                title="Continue with Google"
                onPress={onGoogle}
                testID="google-oauth-button"
                style={{ marginTop: spacing.sm }}
              />

              <Pressable
                onPress={() => router.push("/auth/forgot")}
                style={{ alignSelf: "center", marginTop: spacing.md }}
                testID="forgot-password-link"
              >
                <Text style={styles.linkDim}>Forgot password?</Text>
              </Pressable>
            </GlassCard>

            <View style={styles.footer}>
              <Text style={styles.footerText}>New to NEURA?</Text>
              <Link href="/auth/signup" asChild>
                <Pressable testID="go-to-signup">
                  <Text style={styles.link}> Create an account</Text>
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
  card: { gap: 4 },
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
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  footerText: { color: colors.textDim, fontFamily: fonts.body, fontSize: 13 },
  link: { color: colors.gradientEnd, fontFamily: fonts.bodyBold, fontSize: 13 },
  linkDim: { color: colors.textDim, fontFamily: fonts.bodyMed, fontSize: 13 },
});
