/**
 * NEURA design tokens — redesigned.
 * Glassmorphism dark theme with cyan/violet accents.
 */
export const colors = {
  bg: "#050508",
  bgElevated: "#0b0b14",
  text: "#FFFFFF",
  textDim: "rgba(255,255,255,0.5)",
  textMuted: "rgba(255,255,255,0.3)",
  glassBg: "rgba(255,255,255,0.04)",
  glassBgStrong: "rgba(255,255,255,0.06)",
  glassBorder: "rgba(255,255,255,0.08)",
  glassBorderStrong: "rgba(255,255,255,0.14)",
  primary: "#00D4FF",
  secondary: "#8B5CF6",
  gradientStart: "#00D4FF",
  gradientEnd: "#8B5CF6",
  danger: "#FF6B6B",
  warn: "#FFD700",
  success: "#00FF88",
  stressLow: "#00FF88",
  stressMed: "#00D4FF",
  stressHigh: "#8B5CF6",
  stressCritical: "#FF6B6B",
};

export const zoneColors: Record<string, string> = {
  Work: "#00D4FF",
  Home: "#FF9500",
  Health: "#00FF88",
  Finance: "#FFD700",
  Family: "#FF6B6B",
  Self: "#8B5CF6",
};

export const zoneEmojis: Record<string, string> = {
  Work: "🧠",
  Home: "🏠",
  Health: "❤️",
  Finance: "💰",
  Family: "👨‍👩‍👧",
  Self: "🌱",
};

export const zoneIcons: Record<string, string> = {
  Health: "heart-outline",
  Home: "home-outline",
  Finance: "wallet-outline",
  Work: "briefcase-outline",
  Family: "people-outline",
  Self: "sparkles-outline",
};

export const ALL_ZONES = ["Work", "Home", "Health", "Finance", "Family", "Self"] as const;
export type ZoneName = (typeof ALL_ZONES)[number];

export const urgencyColors = {
  low: "#00FF88",
  med: "#00D4FF",
  high: "#FF6B6B",
};

export const emotionEmojis = [
  { key: "frustrated", emoji: "😤", label: "Frustrated" },
  { key: "anxious", emoji: "😰", label: "Anxious" },
  { key: "excited", emoji: "😊", label: "Excited" },
  { key: "neutral", emoji: "😐", label: "Neutral" },
  { key: "draining", emoji: "😴", label: "Draining" },
] as const;

export const radius = { card: 16, button: 12, pill: 9999, sm: 10 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const fonts = {
  heading: "SpaceGrotesk_700Bold",
  headingBlack: "SpaceGrotesk_700Bold",
  headingMed: "SpaceGrotesk_600SemiBold",
  body: "SpaceGrotesk_400Regular",
  bodyMed: "SpaceGrotesk_500Medium",
  bodyBold: "SpaceGrotesk_700Bold",
};

export const glowShadow = {
  shadowColor: "#00D4FF",
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.3,
  shadowRadius: 20,
  elevation: 10,
};
