import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, View, StyleSheet } from "react-native";
import { colors, fonts } from "@/src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "rgba(255,255,255,0.04)",
          borderTopColor: colors.glassBorder,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 68,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
          paddingTop: 8,
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          ...(Platform.OS === "web"
            ? {
                // @ts-ignore web-only
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
              }
            : {}),
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: "rgba(255,255,255,0.3)",
        tabBarLabelStyle: {
          fontFamily: fonts.bodyMed,
          fontSize: 10,
          letterSpacing: 0.3,
        },
        tabBarItemStyle: {
          // Glow effect on active tab handled via tint
        },
      }}
    >
      <Tabs.Screen
        name="galaxy"
        options={{
          title: "Galaxy",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <Ionicons name={focused ? "planet" : "planet-outline"} size={22} color={color} />
            </View>
          ),
          tabBarButtonTestID: "tab-galaxy",
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Tasks",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <Ionicons name={focused ? "checkbox" : "checkbox-outline"} size={22} color={color} />
            </View>
          ),
          tabBarButtonTestID: "tab-tasks",
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: "AI",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <Ionicons name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} size={22} color={color} />
            </View>
          ),
          tabBarButtonTestID: "tab-ai",
        }}
      />
      <Tabs.Screen
        name="forecast"
        options={{
          title: "Forecast",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <Ionicons name={focused ? "trending-up" : "trending-up-outline"} size={22} color={color} />
            </View>
          ),
          tabBarButtonTestID: "tab-forecast",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <Ionicons name={focused ? "settings" : "settings-outline"} size={22} color={color} />
            </View>
          ),
          tabBarButtonTestID: "tab-settings",
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeIconWrap: {
    shadowColor: "#00D4FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
});
