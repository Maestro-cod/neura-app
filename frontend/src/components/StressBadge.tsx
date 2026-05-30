import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { fonts, colors } from "@/src/theme";

function getStressColor(level: "low" | "med" | "high"): string {
  if (level === "low") return colors.stressLow;
  if (level === "med") return colors.stressMed;
  return colors.stressCritical;
}

export function StressBadge({ level, testID }: { level: "low" | "med" | "high"; testID?: string }) {
  const color = getStressColor(level);
  const label = level === "med" ? "Medium" : level === "high" ? "High" : "Low";
  return (
    <View testID={testID} style={[styles.badge, { backgroundColor: color + "15", borderColor: color + "44" }]}>
      <View style={[styles.dot, { backgroundColor: color, shadowColor: color, shadowOpacity: 0.6, shadowRadius: 4, elevation: 3 }]} />
      <Text style={[styles.text, { color }]}>Stress · {label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.4 },
});
