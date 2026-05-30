import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { colors, radius } from "@/src/theme";

export function GlassCard({
  children,
  style,
  strong,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  strong?: boolean;
  testID?: string;
}) {
  const bg = strong ? colors.glassBgStrong : colors.glassBg;
  const border = strong ? colors.glassBorderStrong : colors.glassBorder;

  // On web, use CSS backdrop-filter; on native, use BlurView or fallback
  if (Platform.OS === "web") {
    return (
      <View
        testID={testID}
        style={[
          styles.card,
          {
            backgroundColor: bg,
            borderColor: border,
            // @ts-ignore — web-only CSS property
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <View testID={testID} style={[styles.card, { borderColor: border, overflow: "hidden" }, style]}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: 16,
  },
  content: {
    // Content sits above the blur layers
  },
});
