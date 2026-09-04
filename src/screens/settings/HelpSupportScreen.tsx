/**
 * frontend/src/screens/settings/HelpSupportScreen.tsx
 * ---------------------------------------------------------------------------
 * Four answers and a way to ask a fifth.
 *
 * The FAQ is one group of rows that open in place, not four separate cards
 * with "▲"/"▼" text characters for arrows. The message form hands off to the
 * device's mail client — there is no ticketing backend, and pretending a
 * message was "submitted" and discarding it would be worse than saying so.
 *
 * The address comes from core/legal/documents, the same one the privacy
 * policy prints. This screen had its own copy, at a different domain.
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, SafeAreaView, Linking, KeyboardAvoidingView, Platform } from "react-native";
import { notify } from "../../services/notify";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import { SectionTitle } from "../../components/ui/SectionTitle";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { useTheme } from "../../theme/ThemeProvider";
import { selectionFeedback } from "../../services/haptics";
import { SUPPORT_EMAIL } from "../../core/legal/documents";

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  { q: "How does the agent write code?", a: "It reads your project's files, plans a change, writes and edits files, and runs commands in an isolated sandbox — then tells you what it changed. A restore point is saved before every run that can touch your files." },
  { q: "Can I undo what the agent did?", a: "Yes. A restore point is saved before every run that can change files. Open Restore points from the + menu, or tap 'Undo this change' under the message. Rolling back saves a restore point first, so it can be undone too." },
  { q: "Is there a limit on how much I can build?", a: "Yes, a rolling one: a number of builds and chat messages per 12 hours. The app tells you when you reach it and when it resets." },
  { q: "Can I use my own AI provider?", a: "Yes. Add a key from any OpenAI-compatible endpoint under Your AI providers. Your runs then use it and the tokens are billed to you." },
];

export const HelpSupportScreen = () => {
  const { colors } = useTheme();

  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!subject || !message) {
      notify("Missing details", "Add a subject and a message.");
      return;
    }
    setSending(true);
    try {
      const url =
        `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(message)}`;
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) throw new Error("No mail app is available on this device.");
      await Linking.openURL(url);
      setMessage("");
      setSubject("");
    } catch {
      notify("Could not open your mail app", `Email us directly at ${SUPPORT_EMAIL}.`);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <ScreenHeader title="Help" divider={false} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <SectionTitle first>Common questions</SectionTitle>
          <Card flush>
            {FAQS.map((faq, idx) => {
              const open = expandedIdx === idx;
              const last = idx === FAQS.length - 1;
              return (
                <View
                  key={faq.q}
                  style={{ borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.borderHairline }}
                >
                  <TouchableOpacity
                    onPress={() => { selectionFeedback(); setExpandedIdx(open ? null : idx); }}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    className="flex-row items-center px-4 py-3.5"
                    activeOpacity={0.6}
                  >
                    <Text variant="body" className="flex-1 pr-3">{faq.q}</Text>
                    <Icon
                      name="chevron-down"
                      size={16}
                      color={colors.inkMuted}
                      style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
                    />
                  </TouchableOpacity>
                  {open ? (
                    <Text variant="caption" className="px-4 pb-4" style={{ color: colors.inkSecondary, lineHeight: 19 }}>
                      {faq.a}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </Card>

          <SectionTitle hint={`Opens your mail app with a message to ${SUPPORT_EMAIL}.`}>Write to us</SectionTitle>
          <View className="px-1">
            <Input label="Subject" value={subject} onChangeText={setSubject} placeholder="What is this about?" autoCapitalize="sentences" />
            <Input
              label="Message"
              value={message}
              onChangeText={setMessage}
              placeholder="What happened, and what you expected"
              multiline
              numberOfLines={5}
              autoCapitalize="sentences"
              style={{ minHeight: 120, paddingTop: 12, textAlignVertical: "top" }}
            />
            <Button label="Send" loading={sending} onPress={() => void handleSend()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
