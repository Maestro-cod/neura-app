import React, { useMemo } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

/**
 * Animated cosmic starfield placeholder.
 * Renders a deep nebula gradient + ~80 stars that twinkle and slowly drift.
 * The view sets `nativeID="galaxy-canvas"` so the 3D layer can be injected on top.
 */
type Star = { x: number; y: number; size: number; delay: number; duration: number; tint: string };

const TINTS = ["#ffffff", "#a0e8ff", "#9affd8", "#d0c0ff", "#00f5a0", "#00d4ff"];

function makeStars(w: number, h: number, count = 80): Star[] {
  const out: Star[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      x: Math.random() * w,
      y: Math.random() * h,
      size: 1 + Math.random() * 2.5,
      delay: Math.random() * 4000,
      duration: 2200 + Math.random() * 3500,
      tint: TINTS[Math.floor(Math.random() * TINTS.length)],
    });
  }
  return out;
}

function StarDot({ star }: { star: Star }) {
  const opacity = useSharedValue(0.2);
  React.useEffect(() => {
    opacity.value = withDelay(
      star.delay,
      withRepeat(withTiming(1, { duration: star.duration, easing: Easing.inOut(Easing.sin) }), -1, true)
    );
  }, [opacity, star.delay, star.duration]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.star,
        {
          left: star.x,
          top: star.y,
          width: star.size,
          height: star.size,
          borderRadius: star.size,
          backgroundColor: star.tint,
          shadowColor: star.tint,
        },
        style,
      ]}
    />
  );
}

export function GalaxyCanvas() {
  const { width, height } = Dimensions.get("window");
  const stars = useMemo(() => makeStars(width, height, 90), [width, height]);
  const nebulaRotation = useSharedValue(0);
  React.useEffect(() => {
    nebulaRotation.value = withRepeat(withTiming(360, { duration: 60000, easing: Easing.linear }), -1, false);
  }, [nebulaRotation]);
  const nebulaStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${nebulaRotation.value}deg` }] }));

  return (
    <View nativeID="galaxy-canvas" testID="galaxy-canvas-container" style={StyleSheet.absoluteFill}>
      {/* base dark gradient */}
      <LinearGradient
        colors={["#02020a", "#050518", "#080324"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {/* nebula soft glow blobs */}
      <Animated.View style={[styles.nebulaWrap, nebulaStyle]}>
        <View style={[styles.blob, { backgroundColor: "#00f5a022", top: height * 0.1, left: width * 0.1 }]} />
        <View style={[styles.blob, { backgroundColor: "#00d4ff20", top: height * 0.5, left: width * 0.5, width: 320, height: 320 }]} />
        <View style={[styles.blob, { backgroundColor: "#7c6fff1A", top: height * 0.3, left: width * 0.6, width: 260, height: 260 }]} />
        <View style={[styles.blob, { backgroundColor: "#ff6b9d18", top: height * 0.7, left: width * 0.05, width: 240, height: 240 }]} />
      </Animated.View>
      {stars.map((s, i) => (
        <StarDot key={i} star={s} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  nebulaWrap: { ...StyleSheet.absoluteFillObject },
  blob: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 999,
    opacity: 0.8,
  },
  star: {
    position: "absolute",
    shadowOpacity: 0.9,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
});
