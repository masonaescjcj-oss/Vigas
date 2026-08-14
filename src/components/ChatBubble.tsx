/**
 * frontend/src/components/ChatBubble.tsx
 * ---------------------------------------------------------------------------
 * Chat Bubble components matching Perplexity / Claude aesthetics:
 *   - User: Right-aligned, Pill shape (rounded-pill), surfaceRaised background.
 *   - Agent: Left-aligned, no background, editorial Serif typography.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View } from "react-native";
import { Text } from "./Typography";
import { useTheme } from "../theme/ThemeProvider";

interface ChatBubbleProps {
  content: string;
  sender: "user" | "agent";
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ content, sender }) => {
  const { colors } = useTheme();

  const isUser = sender === "user";

  if (isUser) {
    return (
      <View className="flex-row justify-end my-2 px-4">
        {/* User Bubble: Pill shape, padded, background raised */}
        <View 
          className="bg-surfaceRaised py-3 px-5 max-w-[80%] rounded-[24px] border border-borderHairline"
          style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
        >
          <Text variant="body" className="text-inkPrimary">
            {content}
          </Text>
        </View>
      </View>
    );
  }

  // Agent response: Editorial serif, no background, clean left-aligned
  return (
    <View className="flex-row justify-start my-3 px-4">
      <View className="max-w-[90%]">
        <Text variant="bodySerif" className="text-inkPrimary">
          {content}
        </Text>
      </View>
    </View>
  );
};
