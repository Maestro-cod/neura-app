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
          backgroundColor: "rgba(5,5,8,0.92)",
          borderTopColor: colors.glassBorderStrong,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 68,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.gradientStart,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: { fontFamily: fonts.bodyMed, fontSize: 10, letterSpacing: 0.3 },
      }}
    >
      <Tabs.Screen
        name="galaxy"
        options={{
          title: "Galaxy",
          tabBarIcon: ({ color, size }) => <Ionicons name="planet-outline" size={size} color={color} />,
          tabBarButtonTestID: "tab-galaxy",
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Tasks",
          tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-circle-outline" size={size} color={color} />,
          tabBarButtonTestID: "tab-tasks",
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: "AI",
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles-outline" size={size} color={color} />,
          tabBarButtonTestID: "tab-ai",
        }}
      />
      <Tabs.Screen
        name="forecast"
        options={{
          title: "Forecast",
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
          tabBarButtonTestID: "tab-forecast",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
          tabBarButtonTestID: "tab-settings",
        }}
      />
    </Tabs>
  );
}
