/**
 * frontend/src/components/InputComposer.tsx
 * ---------------------------------------------------------------------------
 * Input Composer component matching Perplexity / Claude aesthetics:
 *   - Pill shape (fully rounded container)
 *   - Soft shadow for depth
 *   - Circular send button in brandPrimary
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

interface InputComposerProps {
  onSend: (text: string) => void;
  placeholder?: string;
}

export const InputComposer: React.FC<InputComposerProps> = ({
  onSend,
  placeholder = "Ask or write a command...",
}) => {
  const { colors } = useTheme();
  const [text, setText] = useState("");

  const handleSend = () => {
    if (text.trim() === "") return;
    onSend(text);
    setText("");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      className="px-4 py-3 border-t border-borderHairline"
      style={{ borderTopColor: colors.borderHairline, backgroundColor: colors.canvasBase }}
    >
      {/* Pill shape container with soft shadow */}
      <View 
        className="flex-row items-center bg-surfaceRaised px-4 py-2 rounded-pill border border-borderHairline shadow-sm"
        style={{ 
          backgroundColor: colors.surfaceRaised, 
          borderColor: colors.borderHairline,
          // Custom soft shadows matching premium design
          shadowColor: colors.inkPrimary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        {/* Text Input */}
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={colors.inkSecondary}
          className="flex-1 font-uiRegular text-sm py-1.5 text-left"
          style={{ 
            color: colors.inkPrimary,
            textAlign: "left"
          }}
          multiline={false}
          onSubmitEditing={handleSend}
        />

        {/* Circular Send Button */}
        <TouchableOpacity
          onPress={handleSend}
          disabled={text.trim() === ""}
          className="w-8 h-8 rounded-full items-center justify-center ml-2"
          activeOpacity={0.8}
          style={{ 
            backgroundColor: colors.brandPrimary,
            opacity: text.trim() === "" ? 0.4 : 1.0 
          }}
        >
          {/* Custom send icon - upward chevron/arrow */}
          <View>
            <View 
              style={{
                width: 0,
                height: 0,
                borderStyle: "solid",
                borderLeftWidth: 5,
                borderRightWidth: 5,
                borderBottomWidth: 8,
                borderLeftColor: "transparent",
                borderRightColor: "transparent",
                borderBottomColor: colors.canvasBase,
                marginBottom: 2,
              }}
            />
          </View>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};
