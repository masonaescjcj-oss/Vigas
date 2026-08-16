/**
 * frontend/src/screens/admin/adminUi.tsx
 * ---------------------------------------------------------------------------
 * The handful of shapes every admin tab needs: a card, a labelled field, a
 * status pill, a button.
 *
 * Kept here so the four tabs cannot drift into four slightly different looks —
 * which is exactly how the rest of the app ended up with seventy hand-picked
 * colour pairs before the palette sweep.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, TextInput, TouchableOpacity, ActivityIndicator, type TextInputProps } from "react-native";
import { Text } from "../../components/Typography";
import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeProvider";
import { tapFeedback } from "../../services/haptics";

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => {
  const { colors } = useTheme();
  return (
    <View
      className={`p-4 rounded-2xl border mb-3 ${className}`}
      style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
    >
      {children}
    </View>
  );
};

export const SectionTitle: React.FC<{ children: React.ReactNode; hint?: string }> = ({
  children,
  hint,
}) => {
  const { colors } = useTheme();
  return (
    <View className="mb-3 mt-1">
      <Text variant="label" className="text-left">{children}</Text>
      {hint ? (
        <Text
          variant="caption"
          className="text-left leading-5 mt-1.5 text-[11px]"
          style={{ color: colors.inkMuted }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
};

interface FieldProps extends TextInputProps {
  label: string;
  hint?: string;
}

export const Field: React.FC<FieldProps> = ({ label, hint, style, ...props }) => {
  const { colors } = useTheme();
  return (
    <View className="mb-3">
      <Text
        variant="caption"
        className="text-left mb-1.5 text-[11px]"
        style={{ color: colors.inkMuted }}
      >
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.inkMuted}
        autoCapitalize="none"
        autoCorrect={false}
        className="rounded-xl border px-3 py-2.5 text-sm"
        style={[
          {
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.borderHairline,
            color: colors.inkPrimary,
          },
          style,
        ]}
        {...props}
      />
      {hint ? (
        <Text
          variant="caption"
          className="text-left mt-1 text-[10px] leading-4"
          style={{ color: colors.inkMuted }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
};

export const Pill: React.FC<{ tone: "success" | "warning" | "failed" | "muted"; children: React.ReactNode }> = ({
  tone,
  children,
}) => {
  const { colors } = useTheme();
  const map = {
    success: { bg: colors.successSoft, fg: colors.success },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    failed: { bg: colors.failedSoft, fg: colors.failed },
    muted: { bg: colors.surfaceMuted, fg: colors.inkMuted },
  }[tone];
  return (
    <View className="px-2 py-0.5 rounded-md" style={{ backgroundColor: map.bg }}>
      <Text variant="caption" className="text-[10px] font-uiMedium" style={{ color: map.fg }}>
        {children}
      </Text>
    </View>
  );
};

interface ActionProps {
  label: string;
  onPress: () => void;
  tone?: "primary" | "neutral" | "danger";
  busy?: boolean;
  disabled?: boolean;
  icon?: string;
  className?: string;
}

export const Action: React.FC<ActionProps> = ({
  label,
  onPress,
  tone = "neutral",
  busy = false,
  disabled = false,
  icon,
  className = "",
}) => {
  const { colors } = useTheme();
  const map = {
    primary: { bg: colors.brandPrimary, fg: colors.canvasBase },
    neutral: { bg: colors.surfaceMuted, fg: colors.inkPrimary },
    danger: { bg: colors.failedSoft, fg: colors.failed },
  }[tone];

  return (
    <TouchableOpacity
      onPress={() => {
        if (disabled || busy) return;
        tapFeedback();
        onPress();
      }}
      disabled={disabled || busy}
      className={`px-3.5 py-2 rounded-xl flex-row items-center justify-center ${className}`}
      style={{ backgroundColor: map.bg, opacity: disabled ? 0.4 : 1 }}
      activeOpacity={0.8}
    >
      {busy ? (
        <ActivityIndicator size="small" color={map.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={12} color={map.fg} style={{ marginRight: 6 }} /> : null}
          <Text variant="caption" className="text-[12px] font-uiSemiBold" style={{ color: map.fg }}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

/** A labelled number, for the overview. */
export const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const { colors } = useTheme();
  return (
    <View
      className="flex-1 p-3.5 rounded-2xl border mr-2"
      style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
    >
      <Text variant="h3" className="text-left font-uiSemiBold">{value}</Text>
      <Text
        variant="caption"
        className="text-left mt-0.5 text-[10px]"
        style={{ color: colors.inkMuted }}
      >
        {label}
      </Text>
    </View>
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
      <View className="py-10 items-center">
        <ActivityIndicator size="small" color={colors.brandPrimary} />
      </View>
    );
  }
  if (!empty) return null;
  return (
    <Card>
      <Text variant="caption" className="text-left leading-5" style={{ color: colors.inkMuted }}>
        {emptyText}
      </Text>
    </Card>
  );
};
