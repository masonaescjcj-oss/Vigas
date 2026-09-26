/**
 * frontend/src/screens/auth/WelcomeScreen.tsx
 * ---------------------------------------------------------------------------
 * The front of the instrument: a speaker grille with its light on, the name,
 * one sentence, a spec plate, and the two ways in.
 *
 * There was a third way in, "Continue as Guest", built on signInAnonymously().
 * It was removed rather than fixed: it needs anonymous sign-ins enabled on the
 * project, and an account that cannot receive a password reset is a dead end
 * for the user's projects rather than a shortcut into them.
 *
 * The spec plate is the label on the back of a device: three lines, legend on
 * the left, what it does on the right. It says what the app is in the words a
 * person would check it against, not in marketing.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, SafeAreaView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { MatrixMark } from "../../components/ui/MatrixMark";
import { type AuthStackParamList } from "../../navigation/types";
import { useTheme } from "../../theme/ThemeProvider";
import appConfig from "../../../app.json";

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, "Welcome">;

const SPEC = [
  { legend: "chat", value: "ask about anything" },
  { legend: "build", value: "writes and runs real projects" },
  { legend: "preview", value: "watch it run as it is built" },
];

export const WelcomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvasBase }}>
      <View className="flex-1 px-6 pt-5 pb-7">
        <View className="flex-row justify-between items-center">
          <Text variant="label" style={{ fontSize: 11, letterSpacing: 0.6 }}>retro code</Text>
          <Text variant="label" style={{ fontSize: 11, letterSpacing: 0.6 }}>ai agent · v{appConfig.expo.version}</Text>
        </View>

        <View className="flex-1 justify-center" style={{ gap: 32 }}>
          <MatrixMark size={176} />

          <View style={{ gap: 14 }}>
            <Text variant="h1" style={{ fontSize: 64, lineHeight: 64, letterSpacing: -3 }}>
              retro<Text variant="h1" style={{ fontSize: 64, lineHeight: 64, color: colors.brandPrimary }}>.</Text>
            </Text>
            <Text variant="body" style={{ fontSize: 17, lineHeight: 26, color: colors.inkSecondary, maxWidth: 320 }}>
              Describe an app. An agent plans it, writes it and runs it — then hands you something you can open.
            </Text>
          </View>

          <View accessibilityRole="list">
            {SPEC.map((row, i) => (
              <View
                key={row.legend}
                className="flex-row justify-between items-baseline"
                style={{
                  paddingVertical: 13,
                  borderTopWidth: 1,
                  borderBottomWidth: i === SPEC.length - 1 ? 1 : 0,
                  borderColor: colors.borderHairline,
                }}
              >
                <Text variant="label">{row.legend}</Text>
                <Text variant="body" style={{ fontSize: 14 }}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Button label="Sign in" block onPress={() => navigation.navigate("Login")} />
          <Button label="Create an account" tone="neutral" block onPress={() => navigation.navigate("SignUp")} />
        </View>
      </View>
    </SafeAreaView>
  );
};
