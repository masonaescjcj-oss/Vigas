/**
 * frontend/src/screens/settings/ProfileMainScreen.tsx
 * ---------------------------------------------------------------------------
 * Who is signed in, and the list of things they can change.
 *
 * The avatar circle with a brand-coloured silhouette in it is gone — nobody
 * uploads an avatar here, so it was a picture of a feature. The name and
 * email are the identity. Below them, rows grouped by what they are about:
 * the account, the tools, help. Sign out is the last row, in red, not a
 * lone pill floating under the list.
 *
 * Providers and Shared links used to be reachable only from the chat's menu.
 * They are settings; they belong here too.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, ScrollView, TouchableOpacity, SafeAreaView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { confirmAction } from "../../services/notify";
import { describeSubscription } from "../../core/billing/subscriptionState";
import { PURCHASES } from "../../services/distributionChannel";
import { Text } from "../../components/Typography";
import { SettingsRow } from "../../components/SettingsRow";
import { Card } from "../../components/ui/Card";
import { Pill } from "../../components/ui/Pill";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuthStore } from "../../stores/authStore";
import { type ProfileStackParamList } from "../../types/navigation";

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList, "ProfileMain">;

export const ProfileMainScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  // user as well as profile: the profile row can lag the session by a moment,
  // and showing an empty line where the email goes reads as "no email".
  const { profile, user, signOut } = useAuthStore();
  const plan = describeSubscription({ tier: profile?.subscription_tier });
  // A Play build states the plan and stops. The tap is what Play regulates,
  // not the sentence, so the badge stays and only the navigation goes.
  const canBuy = PURCHASES.canLinkOut;

  const handleSignOut = async () => {
    const confirmed = await confirmAction(
      "Sign out",
      "Are you sure you want to sign out?",
      { destructive: true, confirmLabel: "Sign out" },
    );
    if (confirmed) await signOut();
  };

  const email = profile?.email || user?.email || "";

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      {/* The tab bar is hidden, so this is the root of a stack you cannot
          otherwise leave. Back goes to the chat, which is where you came from. */}
      <ScreenHeader
        title="Account"
        divider={false}
        onBack={() => navigation.getParent()?.navigate("AgentTab")}
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {/* Identity. The name is the heading; the email is the line under it. */}
        <View className="px-1 pt-1 pb-6">
          <Text variant="h2" className="font-uiSemiBold" numberOfLines={1}>
            {profile?.display_name || "Your account"}
          </Text>
          {email ? (
            <Text variant="body" className="mt-1" style={{ color: colors.inkSecondary }} numberOfLines={1}>
              {email}
            </Text>
          ) : null}

          {/* Subscription state, only while there is a paid alternative to
              measure it against. "Free" on its own raises a question the app
              cannot answer. */}
          {PURCHASES.canMentionPlans ? (
            <TouchableOpacity
              onPress={() => navigation.getParent()?.navigate("Paywall", {})}
              disabled={!plan.action || !canBuy}
              className="flex-row items-center mt-3 self-start"
              activeOpacity={0.6}
            >
              <Pill tone={plan.needsAttention ? "warning" : "brand"}>{plan.badge}</Pill>
              {plan.action && canBuy ? (
                <Text variant="caption" className="ml-2 font-uiMedium" style={{ color: colors.brandPrimary }}>
                  {plan.action}
                </Text>
              ) : null}
            </TouchableOpacity>
          ) : null}
          {PURCHASES.canMentionPlans && plan.detail ? (
            <Text variant="caption" className="mt-1.5" style={{ color: colors.inkMuted }}>{plan.detail}</Text>
          ) : null}
        </View>

        <Card flush>
          <SettingsRow label="Account" icon="user" hint="Name, password, delete" onPress={() => navigation.navigate("AccountSettings")} />
          <SettingsRow label="Preferences" icon="settings" hint="Theme, model, notifications" onPress={() => navigation.navigate("Preferences")} />
          <SettingsRow label="Security" icon="lock" onPress={() => navigation.navigate("SecuritySettings")} last />
        </Card>

        <Card flush className="mt-4">
          <SettingsRow label="Your AI providers" icon="cpu" hint="Bring your own key" onPress={() => navigation.navigate("Providers")} />
          <SettingsRow label="Shared links" icon="link" hint="Pages you have published" onPress={() => navigation.navigate("SharedLinks")} />
          {/* Lives on the root stack, above the tabs. */}
          <SettingsRow label="Usage" icon="chart" hint="Builds and messages this window" onPress={() => navigation.getParent()?.navigate("TokenUsage")} last />
        </Card>

        <Card flush className="mt-4">
          <SettingsRow label="Help" icon="info" onPress={() => navigation.navigate("HelpSupport")} />
          <SettingsRow label="About" icon="file-text" onPress={() => navigation.navigate("About")} last={!profile?.is_admin} />
          {profile?.is_admin ? (
            <SettingsRow label="Admin" icon="shield" onPress={() => navigation.navigate("Admin")} last />
          ) : null}
        </Card>

        <Card flush className="mt-4">
          <SettingsRow label="Sign out" destructive onPress={() => void handleSignOut()} last />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};
