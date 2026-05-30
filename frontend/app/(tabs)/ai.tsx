import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { GlassCard } from "@/src/components/GlassCard";
import { UpgradeModal } from "@/src/components/UpgradeModal";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/lib/api";
import { supabase } from "@/src/lib/supabase";

type Msg = { id: string; role: "user" | "assistant"; text: string };

// Animated dots for typing indicator
function TypingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -6, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      );
    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 150);
    const a3 = animate(dot3, 300);
    a1.start();
    a2.start();
    a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={styles.typingWrap}>
      {[dot1, dot2, dot3].map((d, i) => (
        <Animated.View
          key={i}
          style={[
            styles.typingDot,
            { transform: [{ translateY: d }] },
          ]}
        />
      ))}
    </View>
  );
}

// Particle background component
function ParticleBackground() {
  // Generate static particle positions
  const particles = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: Math.random() * 2 + 1,
        opacity: Math.random() * 0.15 + 0.03,
      })),
    []
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p) => (
        <View
          key={p.id}
          style={{
            position: "absolute",
            left: p.left as any,
            top: p.top as any,
            width: p.size,
            height: p.size,
            borderRadius: p.size / 2,
            backgroundColor: `rgba(255,255,255,${p.opacity})`,
          }}
        />
      ))}
    </View>
  );
}

export default function AIAssistant() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "m0",
      role: "assistant",
      text: "Hey — I'm NEURA. Tell me what's on your mind. I know your zones and tasks.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, sending]);

  const isFree = !profile || profile.plan === "free";

  const send = async () => {
    const TAG = "[AI Chat]";
    if (!input.trim() || !user) return;
    if (isFree) {
      setUpgrade(true);
      return;
    }
    setError(null);
    const text = input.trim();
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", text };
    setMessages((cur) => [...cur, userMsg]);
    setInput("");
    setSending(true);
    try {
      // ── Pre-flight: get session token BEFORE calling the API ──
      console.log(TAG, "Getting Supabase session…");
      const { data: { session }, error: sessErr } = await supabase.auth.getSession();

      if (sessErr) {
        console.error(TAG, "getSession error:", sessErr.message);
      }

      const token = session?.access_token;
      console.log(TAG, "Session token:", token ? `Present (${token.slice(0, 12)}…)` : "MISSING");
      console.log(TAG, "User ID:", user.id);

      if (!token) {
        // Session lost — try refreshing it
        console.warn(TAG, "No token — attempting session refresh…");
        const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
        if (refreshErr) {
          console.error(TAG, "Refresh failed:", refreshErr.message);
          throw new Error("Session expired. Please log in again.");
        }
        const refreshedToken = refreshData.session?.access_token;
        console.log(TAG, "Refreshed token:", refreshedToken ? `Present (${refreshedToken.slice(0, 12)}…)` : "Still MISSING");

        if (!refreshedToken) {
          throw new Error("Session expired. Please log in again.");
        }

        // Use refreshed token
        console.log(TAG, "Sending message with refreshed token…");
        const { reply } = await api.aiChat({ user_id: user.id, message: text }, refreshedToken);
        setMessages((cur) => [
          ...cur,
          { id: `a-${Date.now()}`, role: "assistant", text: reply },
        ]);
      } else {
        // Use the existing token
        console.log(TAG, "Sending message with existing token…");
        const { reply } = await api.aiChat({ user_id: user.id, message: text }, token);
        setMessages((cur) => [
          ...cur,
          { id: `a-${Date.now()}`, role: "assistant", text: reply },
        ]);
      }
      console.log(TAG, "Message sent successfully");
    } catch (e: any) {
      console.error(TAG, "Error:", e?.message || e);

      // Show a more specific error message
      const errMsg = e?.message?.includes("401") || e?.message?.includes("authenticated")
        ? "Authentication error. Please restart the app."
        : e?.message?.includes("Backend URL")
          ? "Server not configured. Contact support."
          : "Connection lost. Tap to retry.";

      setError(errMsg);
      setMessages((cur) => [
        ...cur,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: "I had trouble reaching the stars. Try again in a moment.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const onInputFocus = () => {
    if (isFree) setUpgrade(true);
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ParticleBackground />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.headerRow}>
            <Text style={styles.h1}>NEURA AI</Text>
            <View style={styles.onlineDot} />
          </View>
          <Text style={styles.sub}>Powered by Claude · knows your galaxy</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          testID="chat-message-list"
        >
          {isFree && (
            <GlassCard
              strong
              style={[styles.lockCard, { borderColor: colors.primary + "33" }]}
            >
              <Text style={styles.lockTitle}>AI assistant is a Pro feature</Text>
              <Text style={styles.lockSub}>
                Unlock unlimited conversations with NEURA AI.
              </Text>
              <Pressable
                onPress={() => setUpgrade(true)}
                style={styles.unlockBtn}
                testID="ai-upgrade-button"
              >
                <Ionicons name="sparkles" size={14} color="#050508" />
                <Text style={styles.unlockTxt}>Upgrade to Pro</Text>
              </Pressable>
            </GlassCard>
          )}

          {messages.map((m) => (
            <View
              key={m.id}
              style={[
                styles.row,
                m.role === "user" ? styles.rowUser : styles.rowAssist,
              ]}
            >
              {m.role === "assistant" && (
                <View style={styles.aiAvatar}>
                  <Text style={styles.aiAvatarText}>N</Text>
                </View>
              )}
              <View
                style={[
                  styles.bubble,
                  m.role === "user"
                    ? styles.bubbleUser
                    : styles.bubbleAssistant,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    m.role === "user" && { color: "#050508" },
                  ]}
                >
                  {m.text}
                </Text>
              </View>
            </View>
          ))}

          {/* Typing indicator */}
          {sending && (
            <View style={[styles.row, styles.rowAssist]}>
              <View style={styles.aiAvatar}>
                <Text style={styles.aiAvatarText}>N</Text>
              </View>
              <GlassCard strong style={styles.typingBubble}>
                <TypingDots />
              </GlassCard>
            </View>
          )}

          {/* Error card */}
          {error && (
            <Pressable onPress={() => setError(null)}>
              <GlassCard
                style={[styles.errorCard, { borderColor: colors.danger + "55" }]}
              >
                <Text style={styles.errorText}>⚡ {error}</Text>
              </GlassCard>
            </Pressable>
          )}
        </ScrollView>

        {/* Input bar */}
        <View style={styles.inputBar}>
          <GlassCard strong style={styles.inputWrap}>
            <TextInput
              testID="chat-input-field"
              value={input}
              onChangeText={setInput}
              placeholder={
                isFree
                  ? "Upgrade to Pro to chat with NEURA..."
                  : "Ask NEURA anything..."
              }
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              editable={!isFree}
              onFocus={onInputFocus}
              onSubmitEditing={send}
              returnKeyType="send"
              multiline
            />
            <View style={styles.inputActions}>
              <Ionicons name="mic-outline" size={20} color={colors.textMuted} />
              <Pressable
                onPress={send}
                disabled={sending || (!isFree && !input.trim())}
                style={[
                  styles.sendBtn,
                  {
                    opacity: sending || (!isFree && !input.trim()) ? 0.4 : 1,
                  },
                ]}
                testID="chat-send-button"
              >
                <Ionicons name="arrow-up" size={18} color="#050508" />
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </KeyboardAvoidingView>

      <UpgradeModal
        visible={upgrade}
        onClose={() => setUpgrade(false)}
        reason="Chat with NEURA AI is a Pro feature."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  h1: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 24,
    letterSpacing: -0.5,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  sub: {
    color: colors.textDim,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  list: { padding: spacing.lg, paddingBottom: 20 },
  row: { marginBottom: 12, flexDirection: "row", alignItems: "flex-end", gap: 8 },
  rowUser: { justifyContent: "flex-end" },
  rowAssist: { justifyContent: "flex-start" },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary + "22",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.primary + "44",
  },
  aiAvatarText: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: colors.glassBgStrong,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
    borderLeftColor: colors.primary,
    borderLeftWidth: 2,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  typingBubble: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  typingWrap: { flexDirection: "row", gap: 4, alignItems: "center" },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  errorCard: {
    borderColor: colors.danger,
    marginTop: 8,
  },
  errorText: {
    color: colors.danger,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  inputBar: {
    padding: spacing.md,
    paddingBottom: 90,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 22,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    paddingVertical: 6,
  },
  inputActions: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 4 },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  lockCard: { marginBottom: spacing.lg },
  lockTitle: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 16,
    letterSpacing: -0.5,
  },
  lockSub: {
    color: colors.textDim,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 4,
  },
  unlockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9999,
    backgroundColor: colors.primary,
  },
  unlockTxt: {
    color: "#050508",
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
});
