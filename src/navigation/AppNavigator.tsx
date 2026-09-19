/**
 * frontend/src/navigation/AppNavigator.tsx
 * ---------------------------------------------------------------------------
 * Main App Navigator:
 *   - AI Agent Screen (AgentChatScreen) set as the primary initial screen.
 *   - Bottom tab bar menu and dashboard completely removed as requested.
 * ---------------------------------------------------------------------------
 */

import React, { useEffect, useRef } from "react";
import { View, Text } from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme, type NavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuthStore } from "../stores/authStore";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { usePasswordRecovery } from "../hooks/usePasswordRecovery";
import { supabase } from "../services/supabase";
import { useTheme } from "../theme/ThemeProvider";
import { useBreakpoint, columnStyle, FORM_MAX, COLUMN_MAX } from "../theme/breakpoints";

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
import { VerifyCodeScreen } from "../screens/auth/VerifyCodeScreen";

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
const AuthNavigator = ({ startAtReset = false }: { startAtReset?: boolean }) => {
  const { colors } = useTheme();
  const { wide } = useBreakpoint();
  return (
    <AuthStack.Navigator
      // A reset link must land on the reset screen, not walk the user back
      // through Splash and Login while holding a one-use recovery session.
      initialRouteName={startAtReset ? "ResetPassword" : "Splash"}
      screenOptions={{
        headerShown: false,
        // A sign-in form is a column, on any screen. Constrained here so the
        // nine auth screens stay the phone layouts they are.
        contentStyle: { backgroundColor: colors.canvasBase, ...columnStyle(wide, 480) }
      }}
    >
      <AuthStack.Screen name="Splash" component={SplashScreen} />
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <AuthStack.Screen name="VerifyCode" component={VerifyCodeScreen} />
      <AuthStack.Screen name="EmailVerificationPending" component={EmailVerificationPendingScreen} />
    </AuthStack.Navigator>
  );
};

// 2. Project Stack Navigator
const ProjectNavigator = () => {
  const { colors } = useTheme();
  const { wide } = useBreakpoint();
  return (
    <ProjectStack.Navigator
      initialRouteName="AgentChat"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvasBase, ...columnStyle(wide, COLUMN_MAX) }
      }}
    >
      {/* The chat lays itself out for a wide screen — it puts the drawer
          beside the conversation — so it gets the whole width. */}
      <ProjectStack.Screen
        name="AgentChat"
        component={AgentChatScreen}
        options={{ contentStyle: { backgroundColor: colors.canvasBase } }}
      />
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
  const { wide } = useBreakpoint();
  return (
    <ProfileStack.Navigator
      initialRouteName="ProfileMain"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvasBase, ...columnStyle(wide, FORM_MAX) }
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
  const { user, setSession, initialized, passwordRecovery } = useAuthStore();
  const { colors, mode } = useTheme();
  const { wide } = useBreakpoint();

  // React Navigation paints its own container behind every screen, in its
  // own default theme — which is light. That was invisible while each screen
  // covered the whole window; on a wide screen the screens sit in a centred
  // column, and the container showed through as a white field around a dark
  // app. The navigator now uses the app's palette for that container.
  const navTheme = React.useMemo(() => {
    const base = mode === "light" ? DefaultTheme : DarkTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.brandPrimary,
        background: colors.canvasBase,
        card: colors.canvasBase,
        text: colors.inkPrimary,
        border: colors.borderHairline,
        notification: colors.brandPrimary,
      },
    };
  }, [mode, colors]);

  // Held here because the notification tap handler lives outside the navigator
  // tree — it fires before any screen is mounted on a cold start.
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  // Registers this device once signed in, and opens the right project when a
  // "your build is ready" notification is tapped.
  usePushNotifications(user?.id ?? null, navigationRef);

  // Consumes an emailed reset link and raises passwordRecovery before the
  // session lands, so the swap below cannot happen mid-flow.
  usePasswordRecovery();

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
      <NavigationContainer ref={navigationRef} linking={linking as never} theme={navTheme}>
        <RootStack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.canvasBase }
          }}
        >
          {user && !passwordRecovery ? (
            <React.Fragment>
              {/* Authenticated stack with AI Agent as 1st page */}
              <RootStack.Screen name="MainTabs" component={MainTabNavigator} />
              
              {/* Global overlay Modals */}
              <RootStack.Group
                screenOptions={{
                  presentation: "modal",
                  contentStyle: { backgroundColor: colors.canvasBase, ...columnStyle(wide, FORM_MAX) },
                }}
              >
                <RootStack.Screen name="Paywall" component={PaywallScreen} />
                <RootStack.Screen name="ManageSubscription" component={ManageSubscriptionScreen} />
                <RootStack.Screen name="TokenUsage" component={TokenUsageScreen} />
                <RootStack.Screen name="GlobalSearch" component={GlobalSearchScreen} />
              </RootStack.Group>
            </React.Fragment>
          ) : (
            <RootStack.Screen name="AuthStack">
              {() => <AuthNavigator startAtReset={passwordRecovery} />}
            </RootStack.Screen>
          )}
        </RootStack.Navigator>
      </NavigationContainer>
    </View>
  );
};
