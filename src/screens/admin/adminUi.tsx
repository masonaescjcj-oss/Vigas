/**
 * frontend/src/screens/admin/adminUi.tsx
 * ---------------------------------------------------------------------------
 * The shapes the admin tabs are built from.
 *
 * These used to be defined here, and only here — so the admin panel was the one
 * part of the app with a consistent card, field and pill while every other
 * screen hand-rolled its own. The definitions now live in components/ui and
 * serve the whole app; this file keeps the names the tabs import and adapts the
 * two whose props differed, so the four tabs did not have to change.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, ActivityIndicator, type TextInputProps } from "react-native";
import { Text } from "../../components/Typography";
import { useTheme } from "../../theme/ThemeProvider";
import { Button, Card as UiCard, Input, Pill, SectionTitle } from "../../components/ui";

export { Pill, SectionTitle };

/** Admin cards stack with a gap; the shared Card leaves spacing to the caller. */
export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <UiCard className={`mb-3 ${className}`}>{children}</UiCard>
);

interface FieldProps extends TextInputProps {
  label: string;
  hint?: string;
}

/** The admin's labelled field is the app's Input. */
export const Field: React.FC<FieldProps> = ({ label, hint, ...props }) => (
  <Input label={label} hint={hint} {...props} />
);

interface ActionProps {
  label: string;
  onPress: () => void;
  tone?: "primary" | "neutral" | "danger";
  busy?: boolean;
  disabled?: boolean;
  icon?: string;
  className?: string;
}

/** The admin's small action is the app's Button at the small size. */
export const Action: React.FC<ActionProps> = ({ busy = false, ...props }) => (
  <Button size="sm" loading={busy} {...props} />
);

/** A labelled number, for the overview. */
export const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const { colors } = useTheme();
  return (
    <UiCard className="flex-1 mr-2" style={{ padding: 14 }}>
      <Text variant="h3" className="font-uiSemiBold">{value}</Text>
      <Text variant="caption" className="mt-0.5" style={{ color: colors.inkMuted }}>{label}</Text>
    </UiCard>
  );
};

/** Shown while a tab is loading, or when it has nothing to show. */
export const TabState: React.FC<{ loading: boolean; empty: boolean; emptyText: string }> = ({
  loading,
  empty,
  emptyText,
}) => {
  const { colors } = useTheme();
  if (loading) {
    return (
      <View className="py-12 items-center">
        <ActivityIndicator size="small" color={colors.brandPrimary} />
      </View>
    );
  }
  if (empty) {
    return (
      <View className="py-12 items-center px-6">
        <Text variant="caption" className="text-center" style={{ color: colors.inkMuted }}>{emptyText}</Text>
      </View>
    );
  }
  return null;
};
