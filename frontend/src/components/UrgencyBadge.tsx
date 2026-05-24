import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts, urgencyColors } from "@/src/theme";

export function UrgencyBadge({ urgency, testID }: { urgency: "low" | "med" | "high"; testID?: string }) {
  const color = urgencyColors[urgency];
  const label = urgency === "med" ? "Medium" : urgency === "high" ? "High" : "Low";
  return (
    <View testID={testID} style={[styles.badge, { borderColor: color + "55", backgroundColor: color + "20" }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 1,
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" },
});
