import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { colors, fonts, radius, spacing } from "@/src/theme";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * Catches render-time crashes anywhere below it and shows a recovery screen
 * instead of a frozen/blank app. Without this, one bad render white-screens
 * the whole app — exactly the failure mode this app has hit before.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary] caught:", error?.message);
  }

  reset = () => {
    if (Platform.OS === "web") {
      window.location.reload();
    } else {
      this.setState({ error: null });
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          NEURA hit an unexpected error. Your data is safe.
        </Text>
        <Pressable onPress={this.reset} style={styles.button} testID="error-retry">
          <Text style={styles.buttonText}>Reload</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 22,
    letterSpacing: -0.5,
  },
  body: {
    color: colors.textDim,
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: "center",
  },
  button: {
    marginTop: spacing.md,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  buttonText: {
    color: "#050508",
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
});
