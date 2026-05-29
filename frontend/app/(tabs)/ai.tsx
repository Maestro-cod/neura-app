import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { GlassCard } from "@/src/components/GlassCard";
import { UpgradeModal } from "@/src/components/UpgradeModal";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/lib/api";

type Msg = { id: string; role: "user" | "assistant"; text: string };

export default function AIAssistant() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([
    { id: "m0", role: "assistant", text: "Hey — I'm NEURA. Tell me what's on your mind. I know your zones and tasks." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [upgrade, setUpgrade] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const isFree = !profile || profile.plan === "free";

  const send = async () => {
    if (!input.trim() || !user) return;
    if (isFree) {
      setUpgrade(true);
      return;
    }
    const text = input.trim();
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", text };
    setMessages((cur) => [...cur, userMsg]);
    setInput("");
    setSending(true);
    try {
      const { reply } = await api.aiChat({ user_id: user.id, message: text });
      setMessages((cur) => [...cur, { id: `a-${Date.now()}`, role: "assistant", text: reply }]);
    } catch (e: any) {
      setMessages((cur) => [...cur, { id: `a-${Date.now()}`, role: "assistant", text: "I had trouble reaching the stars. Try again in a moment." }]);
    } finally {
      setSending(false);
    }
  };

  const onInputFocus = () => {
    if (isFree) setUpgrade(true);
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.h1}>NEURA AI</Text>
        <Text style={styles.sub}>Claude Sonnet · context-aware</Text>
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
            <GlassCard strong style={{ marginBottom: spacing.md, borderColor: colors.gradientStart + "55" }}>
              <Text style={styles.lockTitle}>AI assistant is a Pro feature</Text>
              <Text style={styles.lockSub}>Unlock unlimited conversations with NEURA AI.</Text>
              <Pressable onPress={() => setUpgrade(true)} style={styles.unlockBtn} testID="ai-upgrade-button">
                <Ionicons name="sparkles" size={14} color="#050508" />
                <Text style={styles.unlockTxt}>Upgrade to Pro</Text>
              </Pressable>
            </GlassCard>
          )}
          {messages.map((m) => (
            <View key={m.id} style={[styles.row, m.role === "user" ? styles.rowUser : styles.rowAssist]}>
              <View
                style={[
                  styles.bubble,
                  m.role === "user"
                    ? { backgroundColor: colors.gradientStart, borderColor: colors.gradientStart }
                    : { backgroundColor: colors.glassBgStrong, borderColor: colors.glassBorderStrong },
                ]}
              >
                <Text style={[styles.bubbleText, m.role === "user" && { color: "#050508" }]}>{m.text}</Text>
              </View>
            </View>
          ))}
          {sending && (
            <View style={[styles.row, styles.rowAssist]}>
              <ActivityIndicator color={colors.gradientStart} />
            </View>
          )}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            testID="chat-input-field"
            value={input}
            onChangeText={setInput}
            placeholder={isFree ? "Upgrade to Pro to chat with NEURA…" : "Ask NEURA anything…"}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            editable={!isFree}
            onFocus={onInputFocus}
            onSubmitEditing={send}
            returnKeyType="send"
            multiline
          />
          <Pressable
            onPress={send}
            disabled={sending || (!isFree && !input.trim())}
            style={[styles.sendBtn, { opacity: sending || (!isFree && !input.trim()) ? 0.5 : 1 }]}
            testID="chat-send-button"
          >
            <Ionicons name="arrow-up" size={20} color="#050508" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <UpgradeModal visible={upgrade} onClose={() => setUpgrade(false)} reason="Chat with NEURA AI is a Pro feature." />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  h1: { color: colors.text, fontFamily: fonts.heading, fontSize: 26 },
  sub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  list: { padding: spacing.lg, paddingBottom: 20 },
  row: { marginBottom: 10, flexDirection: "row" },
  rowUser: { justifyContent: "flex-end" },
  rowAssist: { justifyContent: "flex-start" },
  bubble: { maxWidth: "85%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderWidth: 1 },
  bubbleText: { color: colors.text, fontFamily: fonts.body, fontSize: 14, lineHeight: 19 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: colors.glassBg,
    borderColor: colors.glassBorderStrong,
    borderWidth: 1,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gradientStart,
  },
  lockTitle: { color: colors.text, fontFamily: fonts.heading, fontSize: 16 },
  lockSub: { color: colors.textDim, fontFamily: fonts.body, fontSize: 12, marginTop: 4 },
  unlockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9999,
    backgroundColor: colors.gradientStart,
  },
  unlockTxt: { color: "#050508", fontFamily: fonts.bodyBold, fontSize: 12 },
});
