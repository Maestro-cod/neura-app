import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { colors, radius } from "@/src/theme";

export function SkeletonLoader({
  width,
  height = 16,
  borderRadius = radius.sm,
  style,
}: {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width as any,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.card, style]}>
      <SkeletonLoader width="60%" height={20} />
      <SkeletonLoader width="90%" height={14} style={{ marginTop: 12 }} />
      <SkeletonLoader width="75%" height={14} style={{ marginTop: 8 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  card: {
    backgroundColor: colors.glassBg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: 16,
    marginBottom: 12,
  },
});
