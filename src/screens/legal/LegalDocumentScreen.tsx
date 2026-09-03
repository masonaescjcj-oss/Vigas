/**
 * frontend/src/screens/legal/LegalDocumentScreen.tsx
 * ---------------------------------------------------------------------------
 * Renders a legal document from core/legal/documents.
 *
 * Both screens used to hold their own copy of the text in JSX. Google Play
 * needs the policy at a public URL as well, so a second copy was going to exist
 * either way — and two copies of a legal document drift without anyone noticing
 * which one is true.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, ScrollView, TouchableOpacity, SafeAreaView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../../components/Typography";
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
    <Text variant="body" className="text-left leading-6">
      {splitRich(line).map((span, i) =>
        span.bold ? (
          <Text key={i} variant="body" className="font-uiSemiBold leading-6">
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
  const navigation = useNavigation();

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <View
        className="flex-row items-center justify-between px-6 py-4 border-b"
        style={{ borderBottomColor: colors.borderHairline, backgroundColor: colors.canvasBase }}
      >
        <View className="w-10" />
        <Text variant="h3" className="font-uiSemiBold">{document.title}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <Text variant="body" className="font-uiMedium">Close →</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
        <Text variant="caption" className="text-left opacity-60">
          Last updated {document.updated}
        </Text>

        <Text variant="body" className="text-left leading-6 mt-4">
          {document.intro}
        </Text>

        {document.sections.map((section) => (
          <View key={section.heading} className="mt-7">
            <Text variant="h3" className="font-uiSemiBold text-left mb-2">
              {section.heading}
            </Text>
            {section.body.map((line, i) => (
              <View key={i} className={isBullet(line) ? "flex-row mt-1.5" : "mt-1.5"}>
                {isBullet(line) ? (
                  <>
                    <Text variant="body" className="leading-6 mr-2">•</Text>
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
