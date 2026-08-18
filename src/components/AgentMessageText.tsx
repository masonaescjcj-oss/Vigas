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
import { CopyButton } from "./CopyButton";
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
    <Text selectable style={{ color, fontSize: 14, lineHeight: 22, fontFamily: family }}>
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

  const blocks = parseBlocks(content);
  // Offered only when there is prose to copy. If the answer is a single code
  // block, that block's own button already covers it and a second one directly
  // above would just be clutter.
  const showWholeAnswerCopy =
    content.trim().length > 120 && blocks.some((block) => block.type === "text");

  return (
    <View style={{ marginBottom: 12 }}>
      {blocks.map((block, index) =>
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
            {/* The header row always exists now, even without a language, because
                it is what carries the copy button. Selecting code by hand inside
                a horizontally scrolling block on a phone is close to impossible,
                so this is the only practical way to get it out. */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <Text style={{ color: langColor, fontFamily: MONO, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>
                {block.lang ?? "code"}
              </Text>
              <CopyButton value={block.value} compact />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Text
                style={{ color: codeColor, fontFamily: MONO, fontSize: 12.5, lineHeight: 19 }}
                // Long-press selection as well as the button: some people want a
                // fragment rather than the whole block.
                selectable
              >
                {block.value}
              </Text>
            </ScrollView>
          </View>
        ),
      )}

      {showWholeAnswerCopy ? (
        <View style={{ flexDirection: "row", marginTop: 2 }}>
          <CopyButton value={content.trim()} label="Copy answer" compact />
        </View>
      ) : null}
    </View>
  );
};
