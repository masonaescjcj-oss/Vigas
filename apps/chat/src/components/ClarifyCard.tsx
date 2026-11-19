/**
 * frontend/src/components/ClarifyCard.tsx
 * ---------------------------------------------------------------------------
 * The agent's questions, as something you tap.
 *
 * One question at a time rather than a wall of them: on a phone three questions
 * with four options each is a scroll, and the answer to the second often
 * depends on having thought about the first.
 *
 * "Something else" opens a text field, because three options are a guess at the
 * answer space and the real answer is routinely outside it — without a way out,
 * the choice is a wrong option or abandoning the flow.
 *
 * Once answered the card stays in the transcript, showing what was chosen. The
 * conversation should still read correctly scrolled back to weeks later.
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { TextInput, TouchableOpacity, View } from "react-native";
import { Text } from "./Typography";
import { Icon } from "./Icon";
import { useTheme } from "../theme/ThemeProvider";
import { directionStyleFor } from "../theme/direction";
import {
  type ClarifyAnswer,
  type ClarifyRequest,
  OTHER_OPTION,
  optionsFor,
} from "../core/agent/clarify";

interface ClarifyCardProps {
  request: ClarifyRequest;
  /** Set once answered; the card then renders read-only. */
  answers?: ClarifyAnswer[];
  onSubmit: (answers: ClarifyAnswer[]) => void;
}

export const ClarifyCard: React.FC<ClarifyCardProps> = ({ request, answers, onSubmit }) => {
  const { colors } = useTheme();
  const [given, setGiven] = useState<ClarifyAnswer[]>([]);
  const [typing, setTyping] = useState(false);
  const [freeText, setFreeText] = useState("");

  const settled = answers ?? (given.length === request.questions.length ? given : null);
  const index = given.length;
  const current = request.questions[index];

  const answer = (value: string) => {
    const next = [...given, { header: current.header, question: current.question, answer: value }];
    setGiven(next);
    setTyping(false);
    setFreeText("");
    if (next.length === request.questions.length) onSubmit(next);
  };

  // ── Answered: a record of what was chosen, not a live control.
  if (settled) {
    return (
      <View
        className="rounded-2xl border p-3 mt-2"
        style={{ backgroundColor: colors.surfaceMuted, borderColor: colors.borderHairline }}
      >
        {settled.map((entry) => (
          <View key={entry.question} className="flex-row items-start mb-1">
            <Icon name="check" size={12} color={colors.success} style={{ marginTop: 3, marginRight: 6 }} />
            <Text variant="caption" className="flex-1" style={directionStyleFor(entry.answer)}>
              <Text variant="caption" className="opacity-60">{entry.header}: </Text>
              {entry.answer}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View
      className="rounded-2xl border p-4 mt-2"
      style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.brandPrimary }}
    >
      <View className="flex-row items-center mb-2">
        <View
          className="px-2 py-0.5 rounded mr-2"
          style={{ backgroundColor: `${colors.brandPrimary}26` }}
        >
          <Text variant="caption" className="text-[10px] font-mono uppercase" style={{ color: colors.brandPrimary }}>
            {current.header}
          </Text>
        </View>
        {request.questions.length > 1 && (
          <Text variant="caption" className="text-[10px] opacity-50">
            {index + 1} of {request.questions.length}
          </Text>
        )}
      </View>

      <Text variant="body" className="font-uiMedium mb-3" style={directionStyleFor(current.question)}>
        {current.question}
      </Text>

      {typing ? (
        <View>
          <TextInput
            value={freeText}
            onChangeText={setFreeText}
            autoFocus
            multiline
            placeholder="Describe what you want"
            placeholderTextColor={colors.inkMuted}
            onSubmitEditing={() => freeText.trim() && answer(freeText.trim())}
            className="rounded-xl border px-3 py-2.5 text-sm"
            style={{
              backgroundColor: colors.canvasBase,
              borderColor: colors.borderHairline,
              color: colors.inkPrimary,
              minHeight: 64,
              ...directionStyleFor(freeText),
            }}
          />
          <View className="flex-row justify-end mt-2">
            <TouchableOpacity onPress={() => setTyping(false)} className="px-3 py-2 mr-1">
              <Text variant="caption" className="opacity-60">Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => freeText.trim() && answer(freeText.trim())}
              disabled={!freeText.trim()}
              className="px-4 py-2 rounded-lg"
              style={{ backgroundColor: colors.brandPrimary, opacity: freeText.trim() ? 1 : 0.4 }}
            >
              <Text variant="caption" className="font-uiSemiBold" style={{ color: colors.canvasBase }}>
                Send
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        optionsFor(current).map((option) => {
          const isOther = option.label === OTHER_OPTION.label;
          return (
            <TouchableOpacity
              key={option.label}
              onPress={() => (isOther ? setTyping(true) : answer(option.label))}
              accessibilityRole="button"
              className="rounded-xl border px-3 py-2.5 mb-2"
              style={{
                backgroundColor: isOther ? "transparent" : colors.surfaceMuted,
                borderColor: colors.borderHairline,
              }}
            >
              <View className="flex-row items-center">
                {isOther && (
                  <Icon name="edit" size={12} color={colors.inkSecondary} style={{ marginRight: 6 }} />
                )}
                <Text
                  variant="caption"
                  className="font-uiMedium flex-1"
                  style={{ ...directionStyleFor(option.label), color: isOther ? colors.inkSecondary : colors.inkPrimary }}
                >
                  {option.label}
                </Text>
              </View>
              {option.description ? (
                <Text
                  variant="caption"
                  className="text-[11px] opacity-60 mt-0.5"
                  style={directionStyleFor(option.description)}
                >
                  {option.description}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
};
