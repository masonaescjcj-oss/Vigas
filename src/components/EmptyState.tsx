/**
 * frontend/src/components/EmptyState.tsx
 * ---------------------------------------------------------------------------
 * Generic Empty State screen/component with highly customizable props:
 *   - title, description, and emoji icons.
 *   - optional action buttons.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View } from "react-native";
import { Text } from "./Typography";
import { Button } from "./Button";
import { useTheme } from "../theme/ThemeProvider";

interface EmptyStateProps {
  title: string;
  description?: string;
  emoji?: string;
  buttonLabel?: string;
  onButtonPress?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  emoji = "📂",
  buttonLabel,
  onButtonPress,
}) => {
  const { colors } = useTheme();

  return (
    <View className="flex-1 items-center justify-center p-8">
      {/* Icon */}
      <Text className="text-6xl mb-4">{emoji}</Text>

      {/* Message */}
      <Text variant="h3" className="font-uiMedium text-center">
        {title}
      </Text>
      {description && (
        <Text variant="caption" className="text-center mt-2 opacity-70 leading-5">
          {description}
        </Text>
      )}

      {/* Button CTA */}
      {buttonLabel && onButtonPress && (
        <Button
          label={buttonLabel}
          onPress={onButtonPress}
          className="mt-6 w-full"
        />
      )}
    </View>
  );
};
