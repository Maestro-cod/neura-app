/**
 * NEURA design tokens — redesigned.
 * Glassmorphism dark theme with cyan/violet accents.
 */
export type ThemeMode = "light" | "dark";
export const THEME_STORAGE_KEY = "neura.theme.mode";

const darkColors = {
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

const lightColors: typeof darkColors = {
  bg: "#F4F5F9",
  bgElevated: "#FFFFFF",
  text: "#0B0B14",
  textDim: "rgba(11,11,20,0.55)",
  textMuted: "rgba(11,11,20,0.35)",
  glassBg: "rgba(0,0,0,0.03)",
  glassBgStrong: "rgba(0,0,0,0.05)",
  glassBorder: "rgba(0,0,0,0.08)",
  glassBorderStrong: "rgba(0,0,0,0.16)",
  primary: "#0091B8",
  secondary: "#7C3AED",
  gradientStart: "#00B4D8",
  gradientEnd: "#7C3AED",
  danger: "#E5484D",
  warn: "#B8860B",
  success: "#13A05C",
  stressLow: "#13A05C",
  stressMed: "#0091B8",
  stressHigh: "#7C3AED",
  stressCritical: "#E5484D",
};

// Active palette — mutated in place so existing `colors.x` imports stay valid.
// Screens bake these into StyleSheet.create at module load, so the chosen
// palette must be applied before those modules evaluate (see initialMode below).
export const colors = { ...darkColors };

export function applyThemePalette(mode: ThemeMode): void {
  Object.assign(colors, mode === "light" ? lightColors : darkColors);
}

// On web, localStorage is synchronous, so reading it here — at theme module
// load, before any screen imports `colors` — guarantees the right palette is
// baked on first paint. On native this returns dark and the root layout
// applies the stored preference before rendering screens.
function initialMode(): ThemeMode {
  try {
    if (typeof localStorage !== "undefined") {
      const v = localStorage.getItem(THEME_STORAGE_KEY);
      if (v === "light" || v === "dark") return v;
    }
  } catch {
    // localStorage unavailable (native / SSR) — fall through to default.
  }
  return "dark";
}

applyThemePalette(initialMode());

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
