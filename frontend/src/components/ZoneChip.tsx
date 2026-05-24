import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, zoneColors, zoneIcons } from "@/src/theme";

export function ZoneChip({
  name,
  count,
  selected,
  onPress,
  testID,
}: {
  name: string;
  count?: number;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const color = zoneColors[name] || "#888";
  const icon = (zoneIcons[name] || "ellipse-outline") as any;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? color : colors.glassBorder,
          backgroundColor: selected ? color + "1F" : colors.glassBg,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[styles.label, { color: selected ? color : colors.text }]}>{name}</Text>
      {typeof count === "number" && (
        <View style={[styles.countWrap, { backgroundColor: color + "33" }]}>
          <Text style={[styles.count, { color }]}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
  },
  label: { fontFamily: fonts.bodyMed, fontSize: 13 },
  countWrap: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 9999, marginLeft: 2 },
  count: { fontFamily: fonts.bodyBold, fontSize: 11 },
});
