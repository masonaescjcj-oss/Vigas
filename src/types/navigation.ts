/**
 * frontend/src/types/navigation.ts
 * ---------------------------------------------------------------------------
 * Type-safe navigation parameters for the 18+ screens and multiple stacks.
 * Includes complete profile, paywall, search, and legal routes.
 * ---------------------------------------------------------------------------
 */

import { NavigatorScreenParams } from "@react-navigation/native";

// 1. Auth Stack Param List
export type AuthStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Welcome: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string };
  EmailVerificationPending: { email: string };
};

// 2. Project Stack Param List
export type ProjectStackParamList = {
  // The projects list and the new-project dialog live inside the chat screen's
  // sheets; the standalone screens were duplicates nothing navigated to.
  ProjectDetail: { projectId: string };
  ProjectSettings: { projectId: string };
  AgentChat: { projectId: string; sessionId?: string };
  SessionHistory: { projectId: string };
  FileTree: { projectId: string };
  FileViewer: { projectId: string; filePath: string };
  CheckpointList: { projectId: string };
};

// 3. Profile / Settings Stack Param List
export type ProfileStackParamList = {
  ProfileMain: undefined;
  AccountSettings: undefined;
  Preferences: undefined;
  Providers: undefined;
  SharedLinks: undefined;
  Admin: undefined;
  SecuritySettings: undefined;
  HelpSupport: undefined;
  About: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
};

// 4. Main Bottom Tab Param List
export type MainTabParamList = {
  HomeTab: undefined;
  ProjectsTab: NavigatorScreenParams<ProjectStackParamList>;
  AgentTab: { projectId?: string; sessionId?: string };
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

// 5. Global Root Navigator
export type RootStackParamList = {
  AuthStack: NavigatorScreenParams<AuthStackParamList>;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  // Global Modals
  /**
   * lockedModel/requiredTier let the screen name what the user just tried to
   * use, instead of opening on a generic pitch when they tapped a specific model.
   */
  Paywall: { triggeredByLimit?: boolean; lockedModel?: string; requiredTier?: string };
  ManageSubscription: undefined;
  TokenUsage: undefined;
  GlobalSearch: undefined;
};
