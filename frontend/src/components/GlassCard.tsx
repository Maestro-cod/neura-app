import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";
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
  return (
    <View
      testID={testID}
      style={[
        styles.card,
        { backgroundColor: strong ? colors.glassBgStrong : colors.glassBg, borderColor: strong ? colors.glassBorderStrong : colors.glassBorder },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: 16,
  },
});
