/**
 * NEURA design tokens.
 */
export const colors = {
  bg: "#050508",
  bgElevated: "#0b0b14",
  text: "#e8e8f0",
  textDim: "#a0a0b0",
  textMuted: "#6b6b80",
  glassBg: "rgba(255,255,255,0.04)",
  glassBgStrong: "rgba(255,255,255,0.06)",
  glassBorder: "rgba(255,255,255,0.08)",
  glassBorderStrong: "rgba(255,255,255,0.14)",
  gradientStart: "#00f5a0",
  gradientEnd: "#00d4ff",
  danger: "#ff6b6b",
  warn: "#f5a623",
  success: "#00f5a0",
};

export const zoneColors: Record<string, string> = {
  Health: "#00f5a0",
  Home: "#7c6fff",
  Finance: "#f5a623",
  Work: "#00d4ff",
  Family: "#ff6b9d",
  Self: "#c3f53c",
};

export const zoneIcons: Record<string, string> = {
  Health: "heart-outline",
  Home: "home-outline",
  Finance: "wallet-outline",
  Work: "briefcase-outline",
  Family: "people-outline",
  Self: "sparkles-outline",
};

export const ALL_ZONES = ["Health", "Home", "Finance", "Work", "Family", "Self"] as const;
export type ZoneName = (typeof ALL_ZONES)[number];

export const urgencyColors = {
  low: "#00f5a0",
  med: "#f5a623",
  high: "#ff6b9d",
};

export const radius = { card: 16, button: 12, pill: 9999, sm: 10 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const fonts = {
  heading: "Syne_700Bold",
  headingBlack: "Syne_800ExtraBold",
  headingMed: "Syne_600SemiBold",
  body: "DMSans_400Regular",
  bodyMed: "DMSans_500Medium",
  bodyBold: "DMSans_700Bold",
};
