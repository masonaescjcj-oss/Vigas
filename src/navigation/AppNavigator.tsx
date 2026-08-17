/**
 * frontend/src/navigation/AppNavigator.tsx
 * ---------------------------------------------------------------------------
 * Main App Navigator:
 *   - AI Agent Screen (AgentChatScreen) set as the primary initial screen.
 *   - Bottom tab bar menu and dashboard completely removed as requested.
 * ---------------------------------------------------------------------------
 */

import React, { useEffect } from "react";
import { View, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuthStore } from "../stores/authStore";
import { supabase } from "../services/supabase";
import { useTheme } from "../theme/ThemeProvider";

// Import NoInternet Banner overlay
import { NoInternetBanner } from "../components/NoInternetBanner";

// Auth Screens
import { SplashScreen } from "../screens/auth/SplashScreen";
import { OnboardingScreen } from "../screens/auth/OnboardingScreen";
import { WelcomeScreen } from "../screens/auth/WelcomeScreen";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { SignUpScreen } from "../screens/auth/SignUpScreen";
import { ForgotPasswordScreen } from "../screens/auth/ForgotPasswordScreen";
import { ResetPasswordScreen } from "../screens/auth/ResetPasswordScreen";
import { EmailVerificationPendingScreen } from "../screens/auth/EmailVerificationPendingScreen";

// Main AI Agent Screen & Projects Screens
import { AgentChatScreen } from "../screens/chat/AgentChatScreen";
import { ProjectDetailScreen } from "../screens/projects/ProjectDetailScreen";
import { ProjectSettingsScreen } from "../screens/projects/ProjectSettingsScreen";
import { SessionHistoryScreen } from "../screens/chat/SessionHistoryScreen";
import { FileTreeScreen } from "../screens/files/FileTreeScreen";
import { FileViewerScreen } from "../screens/files/FileViewerScreen";
import { CheckpointListScreen } from "../screens/checkpoints/CheckpointListScreen";

// Profile / Settings Screens
import { ProfileMainScreen } from "../screens/settings/ProfileMainScreen";
import { AccountSettingsScreen } from "../screens/settings/AccountSettingsScreen";
import { PreferencesScreen } from "../screens/settings/PreferencesScreen";
import { ProvidersScreen } from "../screens/settings/ProvidersScreen";
import { SharedLinksScreen } from "../screens/settings/SharedLinksScreen";
import { AdminScreen } from "../screens/admin/AdminScreen";
import { SecuritySettingsScreen } from "../screens/settings/SecuritySettingsScreen";
import { HelpSupportScreen } from "../screens/settings/HelpSupportScreen";
import { AboutScreen } from "../screens/settings/AboutScreen";

// Legal Screens
import { PrivacyPolicyScreen } from "../screens/legal/PrivacyPolicyScreen";
import { TermsOfServiceScreen } from "../screens/legal/TermsOfServiceScreen";

// Billing / Search / Notification Modals
import { PaywallScreen } from "../screens/subscription/PaywallScreen";
import { ManageSubscriptionScreen } from "../screens/subscription/ManageSubscriptionScreen";
import { TokenUsageScreen } from "../screens/subscription/TokenUsageScreen";
import { GlobalSearchScreen } from "../screens/search/GlobalSearchScreen";

// Types
import {
  AuthStackParamList,
  ProjectStackParamList,
  ProfileStackParamList,
  MainTabParamList,
  RootStackParamList
} from "../types/navigation";

// Creators
const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const ProjectStack = createNativeStackNavigator<ProjectStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// 1. Auth Stack Navigator
const AuthNavigator = () => {
  const { colors } = useTheme();
  return (
    <AuthStack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvasBase }
      }}
    >
      <AuthStack.Screen name="Splash" component={SplashScreen} />
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <AuthStack.Screen name="EmailVerificationPending" component={EmailVerificationPendingScreen} />
    </AuthStack.Navigator>
  );
};

// 2. Project Stack Navigator
const ProjectNavigator = () => {
  const { colors } = useTheme();
  return (
    <ProjectStack.Navigator
      initialRouteName="AgentChat"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvasBase }
      }}
    >
      <ProjectStack.Screen name="AgentChat" component={AgentChatScreen} />
      <ProjectStack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
      <ProjectStack.Screen name="ProjectSettings" component={ProjectSettingsScreen} />
      <ProjectStack.Screen name="SessionHistory" component={SessionHistoryScreen} />
      <ProjectStack.Screen name="FileTree" component={FileTreeScreen} />
      <ProjectStack.Screen name="FileViewer" component={FileViewerScreen} />
      <ProjectStack.Screen name="CheckpointList" component={CheckpointListScreen} />
    </ProjectStack.Navigator>
  );
};

// 3. Profile Stack Navigator
const ProfileNavigator = () => {
  const { colors } = useTheme();
  return (
    <ProfileStack.Navigator
      initialRouteName="ProfileMain"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvasBase }
      }}
    >
      <ProfileStack.Screen name="ProfileMain" component={ProfileMainScreen} />
      <ProfileStack.Screen name="AccountSettings" component={AccountSettingsScreen} />
      <ProfileStack.Screen name="Preferences" component={PreferencesScreen} />
      <ProfileStack.Screen name="Providers" component={ProvidersScreen} />
      <ProfileStack.Screen name="SharedLinks" component={SharedLinksScreen} />
      <ProfileStack.Screen name="Admin" component={AdminScreen} />
      <ProfileStack.Screen name="SecuritySettings" component={SecuritySettingsScreen} />
      <ProfileStack.Screen name="HelpSupport" component={HelpSupportScreen} />
      <ProfileStack.Screen name="About" component={AboutScreen} />
      <ProfileStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <ProfileStack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
    </ProfileStack.Navigator>
  );
};

// 4. Main Bottom Tab Navigator (TAB BAR COMPLETELY HIDDEN & REMOVED)
const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      initialRouteName="AgentTab"
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" }, // Completely hides & removes bottom tab bar!
      }}
    >
      {/* No initialParams: the chat screen picks or creates a real project on
          the first prompt. It used to be handed a "global-default" sentinel
          left over from the mock era, which is not a project id at all. */}
      <Tab.Screen name="AgentTab" component={AgentChatScreen} />
      <Tab.Screen
        name="ProjectsTab"
        component={ProjectNavigator}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileNavigator}
      />
    </Tab.Navigator>
  );
};

// 5. Root Navigator Switch
export const AppNavigator = () => {
  const { user, setSession, initialized } = useAuthStore();
  const { colors } = useTheme();

  // Watch Supabase auth sessions
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      void setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession]);

  if (!initialized) {
    return null;
  }

  // Cast: the container is typed from the runtime navigator, which does not
  // carry the nested param lists, so the literal config cannot be inferred.
  const linking = {
    prefixes: ["issac://"],
    config: {
      screens: {
        MainTabs: {
          screens: {
            AgentTab: "chat",
            ProjectsTab: {
              screens: {
                AgentChat: "project/:projectId/chat/:sessionId?",
                ProjectDetail: "project/:projectId",
              }
            }
          }
        },
        AuthStack: {
          screens: {
            ResetPassword: "reset-password",
          }
        }
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvasBase }}>
      {/* 1. Global No Internet Banner Overlay */}
      <NoInternetBanner />

      {/* 2. Navigation Container Stacks */}
      <NavigationContainer linking={linking as never}>
        <RootStack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.canvasBase }
          }}
        >
          {user ? (
            <React.Fragment>
              {/* Authenticated stack with AI Agent as 1st page */}
              <RootStack.Screen name="MainTabs" component={MainTabNavigator} />
              
              {/* Global overlay Modals */}
              <RootStack.Group screenOptions={{ presentation: "modal" }}>
                <RootStack.Screen name="Paywall" component={PaywallScreen} />
                <RootStack.Screen name="ManageSubscription" component={ManageSubscriptionScreen} />
                <RootStack.Screen name="TokenUsage" component={TokenUsageScreen} />
                <RootStack.Screen name="GlobalSearch" component={GlobalSearchScreen} />
              </RootStack.Group>
            </React.Fragment>
          ) : (
            <RootStack.Screen name="AuthStack" component={AuthNavigator} />
          )}
        </RootStack.Navigator>
      </NavigationContainer>
    </View>
  );
};
