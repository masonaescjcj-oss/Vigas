/**
 * frontend/src/navigation/types.ts
 * ---------------------------------------------------------------------------
 * Type-safe navigation parameters and types for all screen routes.
 * Covers AuthStack, MainTabs, and ProjectStack.
 * ---------------------------------------------------------------------------
 */

import { NavigatorScreenParams } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

// 1. Auth Stack Routes
export type AuthStackParamList = {
  Auth: undefined;
};

// 3. Project Stack Routes (Nested inside Projects tab)
export type ProjectStackParamList = {
  ProjectList: undefined;
  ChatSession: {
    projectId: string;
    sessionId?: string;
  };
};

// 2. Main Tab Routes
export type MainTabParamList = {
  ProjectsTab: NavigatorScreenParams<ProjectStackParamList>;
  SettingsTab: undefined;
};

// Global Root Stack list to handle authenticated switching
export type RootStackParamList = {
  AuthStack: NavigatorScreenParams<AuthStackParamList>;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
};

// Convenience typing exports for navigation hooks inside screens
export type ProjectNavigationProp = NativeStackNavigationProp<ProjectStackParamList>;
