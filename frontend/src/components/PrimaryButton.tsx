import React from "react";
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle, StyleProp } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts, radius, glowShadow } from "@/src/theme";

export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
  style,
  testID,
  color,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  color?: string;
}) {
  const isDisabled = disabled || loading;
  const btnColor = color || colors.primary;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.wrap,
        glowShadow,
        { opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <LinearGradient
        colors={[btnColor, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color="#050508" />
        ) : (
          <Text style={styles.label}>{title}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function SecondaryButton({
  title,
  onPress,
  testID,
  style,
}: {
  title: string;
  onPress: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.secondary, { opacity: pressed ? 0.7 : 1 }, style]}
    >
      <Text style={styles.secondaryLabel}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.button, overflow: "hidden" },
  gradient: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.button,
  },
  label: {
    color: "#050508",
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    letterSpacing: -0.3,
  },
  secondary: {
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: "center",
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
    backgroundColor: colors.glassBg,
  },
  secondaryLabel: {
    color: colors.text,
    fontFamily: fonts.bodyMed,
    fontSize: 14,
    letterSpacing: -0.3,
  },
});
