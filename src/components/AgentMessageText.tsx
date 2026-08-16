/**
 * frontend/src/components/AgentMessageText.tsx
 * ---------------------------------------------------------------------------
 * Renders agent message text with the small slice of Markdown models actually
 * emit: fenced code blocks, inline `code`, and **bold**. Without this, replies
 * show raw ``` fences and asterisks in the chat.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { ScrollView, Text, View } from "react-native";

/** The loaded monospace. A CSS stack would only ever work on web. */
const MONO = MONO_FAMILY;

import { parseBlocks } from "./markdown";
import { useTheme } from "../theme/ThemeProvider";
import { MONO_FAMILY, fontFamilyFor } from "../theme/fonts";

/** Inline `code` and **bold** inside a prose block. */
const InlineText = ({ value, color, codeBg, codeColor }: { value: string; color: string; codeBg: string; codeColor: string }) => {
  const parts = value.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g).filter(Boolean);
  // An answer in Persian must be set in Vazirmatn; Inter has no Arabic script
  // and the platform would substitute a face of its own choosing.
  const family = fontFamilyFor(value);
  const bold = fontFamilyFor(value, "bold");
  return (
    <Text style={{ color, fontSize: 14, lineHeight: 22, fontFamily: family }}>
      {parts.map((part, index) => {
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          return (
            <Text
              key={index}
              style={{ fontFamily: MONO, fontSize: 12.5, color: codeColor, backgroundColor: codeBg }}
            >
              {` ${part.slice(1, -1)} `}
            </Text>
          );
        }
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return (
            <Text key={index} style={{ fontFamily: bold }}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        return <Text key={index}>{part}</Text>;
      })}
    </Text>
  );
};

export const AgentMessageText = ({
  content,
  isLight,
  textColor,
}: {
  content: string;
  isLight: boolean;
  textColor: string;
}) => {
  const { colors } = useTheme();
  const codeBg = colors.surfaceCode;
  const codeBorder = colors.borderHairline;
  const codeColor = colors.inkPrimary;
  const langColor = colors.inkMuted;

  return (
    <View style={{ marginBottom: 12 }}>
      {parseBlocks(content).map((block, index) =>
        block.type === "text" ? (
          <View key={index} style={{ marginBottom: 4 }}>
            <InlineText value={block.value.trim()} color={textColor} codeBg={codeBg} codeColor={codeColor} />
          </View>
        ) : (
          <View
            key={index}
            style={{
              backgroundColor: codeBg,
              borderColor: codeBorder,
              borderWidth: 1,
              borderRadius: 12,
              paddingVertical: 10,
              paddingHorizontal: 12,
              marginVertical: 8,
            }}
          >
            {block.lang ? (
              <Text style={{ color: langColor, fontFamily: MONO, fontSize: 10, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
                {block.lang}
              </Text>
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Text style={{ color: codeColor, fontFamily: MONO, fontSize: 12.5, lineHeight: 19 }}>
                {block.value}
              </Text>
            </ScrollView>
          </View>
        ),
      )}
    </View>
  );
};
