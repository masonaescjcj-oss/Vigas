/**
 * frontend/src/screens/legal/LegalDocumentScreen.tsx
 * ---------------------------------------------------------------------------
 * Renders a legal document from core/legal/documents.
 *
 * Both screens used to hold their own copy of the text in JSX. Google Play
 * needs the policy at a public URL as well, so a second copy was going to exist
 * either way — and two copies of a legal document drift without anyone noticing
 * which one is true.
 *
 * It is a long read, so the measure is the point: generous line height, real
 * space between sections, and the back control where every other screen has it
 * rather than a "Close →" on the right.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, ScrollView, SafeAreaView } from "react-native";
import { Text } from "../../components/Typography";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { useTheme } from "../../theme/ThemeProvider";
import { bulletText, isBullet, splitRich, type LegalDocument } from "../../core/legal/documents";

/**
 * Renders one line's spans.
 *
 * The splitting itself lives in core/legal/documents, because the same markup
 * is interpreted by the static-page generator too — and two readings of
 * "**bold**" that disagree would put different text in the published policy
 * and the one users see in the app.
 */
function RichLine({ line }: { line: string }) {
  return (
    <Text variant="body" className="text-left" style={{ lineHeight: 23 }}>
      {splitRich(line).map((span, i) =>
        span.bold ? (
          <Text key={i} variant="body" className="font-uiSemiBold" style={{ lineHeight: 23 }}>
            {span.text}
          </Text>
        ) : (
          span.text
        )
      )}
    </Text>
  );
}

export function LegalDocumentScreen({ document }: { document: LegalDocument }) {
  const { colors } = useTheme();

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <ScreenHeader title={document.title} subtitle={`Updated ${document.updated}`} divider={false} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}>
        <Text variant="body" className="text-left mt-2" style={{ color: colors.inkSecondary, lineHeight: 23 }}>
          {document.intro}
        </Text>

        {document.sections.map((section) => (
          <View key={section.heading} className="mt-8">
            <Text variant="h3" className="font-uiSemiBold text-left mb-2.5">
              {section.heading}
            </Text>
            {section.body.map((line, i) => (
              <View key={i} className={isBullet(line) ? "flex-row mt-2" : "mt-2"}>
                {isBullet(line) ? (
                  <>
                    <Text variant="body" style={{ lineHeight: 23, color: colors.inkMuted, marginRight: 10 }}>•</Text>
                    <View className="flex-1">
                      <RichLine line={bulletText(line)} />
                    </View>
                  </>
                ) : (
                  <RichLine line={line} />
                )}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
