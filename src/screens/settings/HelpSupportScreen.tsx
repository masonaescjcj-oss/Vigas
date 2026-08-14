/**
 * frontend/src/screens/settings/HelpSupportScreen.tsx
 * ---------------------------------------------------------------------------
 * Help & Support Screen:
 *   - FAQ Accordion items.
 *   - Support ticket submission simulated form.
 *   - Direct links to logs/documentation.
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, TextInput, Alert, SafeAreaView, Linking } from "react-native";
import { notify } from "../../services/notify";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { useTheme } from "../../theme/ThemeProvider";

const SUPPORT_EMAIL = "support@retrocode.app";

interface FaqItem {
  q: string;
  a: string;
}

export const HelpSupportScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();

  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  
  // Support ticket form inputs
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMsg, setTicketMsg] = useState("");
  const [sending, setSending] = useState(false);

  const faqs: FaqItem[] = [
    { q: "How does the Issac agent write code?", a: "Issac analyzes project files by starting a shell in secure E2B containers, sends build commands, and fixes errors." },
    { q: "How can I cancel my subscription?", a: "Canceling subscriptions can be done via Google Play or App Store settings. There is also a direct link in the 'Manage Subscription' section." },
    { q: "What is the difference between free and pro plans?", a: "The Pro plan has much higher token limits, more powerful Sandbox processors, and full access to Claude 3.5 and GPT-4o models." },
  ];

  const handleSendTicket = async () => {
    if (!ticketSubject || !ticketMsg) {
      notify("Error", "Please fill in the subject and message of the support ticket.");
      return;
    }

    // There is no ticketing backend, so hand the message to the user's mail
    // client instead of pretending it was submitted and discarding it.
    setSending(true);
    try {
      const url =
        `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(ticketSubject)}` +
        `&body=${encodeURIComponent(ticketMsg)}`;
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) throw new Error("No mail app is available on this device.");
      await Linking.openURL(url);
      setTicketMsg("");
      setTicketSubject("");
    } catch (e: any) {
      notify(
        "Could not open your mail app",
        `Please email us directly at ${SUPPORT_EMAIL}.`,
      );
    } finally {
      setSending(false);
    }
  };

  const toggleFaq = (idx: number) => {
    setExpandedIdx(expandedIdx === idx ? null : idx);
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* Header Header */}
        <View className="px-6 py-4 flex-row justify-between items-center border-b border-borderHairline/20" style={{ borderBottomColor: colors.borderHairline }}>
          <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
            <Text variant="body" className="font-uiMedium">← Back</Text>
          </TouchableOpacity>
          <Text variant="h2" className="font-uiSemiBold">Help & Support</Text>
        </View>

        {/* FAQ Accordion */}
        <View className="p-6">
          <Text variant="label" className="text-left mb-4">Frequently Asked Questions (FAQ)</Text>
          
          {faqs.map((faq, idx) => {
            const isExpanded = expandedIdx === idx;
            return (
              <View 
                key={idx}
                className="bg-surfaceRaised rounded-card border border-borderHairline mb-3 overflow-hidden"
                style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
              >
                <TouchableOpacity
                  onPress={() => toggleFaq(idx)}
                  className="p-4 flex-row justify-between items-center"
                  activeOpacity={0.8}
                >
                  <Text variant="body" className="font-uiMedium text-left flex-1 pr-3">
                    {faq.q}
                  </Text>
                  <Text variant="caption" className="opacity-60">{isExpanded ? "▲" : "▼"}</Text>
                </TouchableOpacity>
                
                {isExpanded && (
                  <View className="px-4 pb-4 border-t border-borderHairline/10 pt-2" style={{ borderTopColor: colors.borderHairline }}>
                    <Text variant="caption" className="text-left leading-5 opacity-90">
                      {faq.a}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Divider */}
        <View className="h-[1px] bg-borderHairline mx-6 my-2" style={{ backgroundColor: colors.borderHairline }} />

        {/* Support ticket submission form */}
        <View className="p-6">
          <Text variant="label" className="text-left mb-4">Submit Support Ticket</Text>
          
          <View className="space-y-4">
            <View>
              <Text variant="caption" className="mb-1 font-uiMedium text-left">Subject</Text>
              <TextInput
                value={ticketSubject}
                onChangeText={setTicketSubject}
                placeholder="e.g.: Error in Pro upgrade transaction"
                placeholderTextColor={colors.inkSecondary}
                className="w-full bg-surfaceRaised p-3 rounded-input border border-borderHairline font-uiRegular text-sm text-left"
                style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline, color: colors.inkPrimary }}
              />
            </View>

            <View className="mt-3">
              <Text variant="caption" className="mb-1 font-uiMedium text-left">Message</Text>
              <TextInput
                value={ticketMsg}
                onChangeText={setTicketMsg}
                placeholder="Enter message details..."
                placeholderTextColor={colors.inkSecondary}
                multiline
                numberOfLines={4}
                className="w-full bg-surfaceRaised p-3 rounded-input border border-borderHairline font-uiRegular text-sm text-left h-24"
                style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline, color: colors.inkPrimary, textAlignVertical: "top" }}
              />
            </View>

            <Button
              label="Send Support Message"
              onPress={handleSendTicket}
              loading={sending}
              className="mt-6"
            />
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};
