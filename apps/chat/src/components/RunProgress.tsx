/**
 * frontend/src/components/RunProgress.tsx
 * ---------------------------------------------------------------------------
 * The two steps in a run that are worth reading.
 *
 * The tool log already shows *that* the agent called enter_plan_mode and
 * todo_write. What it could not show is what they said — a plan is paragraphs
 * and a checklist is a list with per-item state, and neither fits in the
 * one-line target a log row has room for. So a run that was in fact methodical
 * (plan, investigate, list the work, do it, tick items off) read to the user as
 * a stack of opaque tool names.
 *
 * Both are agent-authored, and both arrive on the same `agent_tasks` rows the
 * log is already built from.
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { Text } from "./Typography";
import { Icon } from "./Icon";
import { useTheme } from "../theme/ThemeProvider";
import { directionStyleFor } from "../theme/direction";

export interface TodoItem {
  subject: string;
  status: string;
}

/**
 * The checklist, as it stood at that point in the run.
 *
 * `todo_write` is called repeatedly and each call replaces the list, so the
 * caller should render the *latest* one rather than every version — otherwise a
 * five-item task produces five checklists.
 */
export const TodoChecklist: React.FC<{ todos: TodoItem[] }> = ({ todos }) => {
  const { colors } = useTheme();
  if (todos.length === 0) return null;

  const done = todos.filter((todo) => todo.status === "completed").length;

  return (
    <View
      className="rounded-2xl border p-3 mb-3"
      style={{ backgroundColor: colors.surfaceMuted, borderColor: colors.borderHairline }}
    >
      <View className="flex-row items-center mb-2">
        <Icon name="check" size={12} color={colors.inkSecondary} style={{ marginRight: 6 }} />
        <Text variant="caption" className="font-uiSemiBold flex-1">Steps</Text>
        <Text variant="caption" className="text-[11px] opacity-60">{done}/{todos.length}</Text>
      </View>

      {todos.map((todo, index) => {
        const isDone = todo.status === "completed";
        const isActive = todo.status === "in_progress";
        return (
          <View key={`${index}:${todo.subject}`} className="flex-row items-start py-1">
            <View style={{ width: 18, marginTop: 2 }}>
              {isDone ? (
                <Icon name="check" size={11} color={colors.success} />
              ) : isActive ? (
                // A filled dot rather than a spinner: the preview pane gets no
                // animation frames when it is not the visible tab, so anything
                // that has to spin to read as "active" reads as frozen there.
                <View
                  style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brandPrimary, marginTop: 2 }}
                />
              ) : (
                <View
                  style={{
                    width: 7, height: 7, borderRadius: 4, marginTop: 2,
                    borderWidth: 1, borderColor: colors.inkMuted,
                  }}
                />
              )}
            </View>
            <Text
              variant="caption"
              className="flex-1 text-[12px]"
              style={{
                ...directionStyleFor(todo.subject),
                color: isDone ? colors.inkMuted : isActive ? colors.inkPrimary : colors.inkSecondary,
                textDecorationLine: isDone ? "line-through" : "none",
                fontWeight: isActive ? "600" : "400",
              }}
            >
              {todo.subject}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

/** How much of a plan is shown before it needs a tap. */
const PLAN_PREVIEW_LINES = 4;

/**
 * The plan the agent settled on before touching anything.
 *
 * Collapsed by default. It is worth being able to read — it is the one place
 * that says what is about to happen — but on a phone an unprompted twelve-line
 * block pushes the actual conversation off the screen.
 */
export const PlanCard: React.FC<{ plan: string }> = ({ plan }) => {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const lines = plan.split("\n").filter((line) => line.trim());
  const longer = lines.length > PLAN_PREVIEW_LINES;
  const shown = expanded ? lines : lines.slice(0, PLAN_PREVIEW_LINES);

  return (
    <TouchableOpacity
      onPress={() => longer && setExpanded((value) => !value)}
      activeOpacity={longer ? 0.8 : 1}
      accessibilityRole={longer ? "button" : undefined}
      className="rounded-2xl border p-3 mb-3"
      style={{ backgroundColor: colors.surfaceMuted, borderColor: colors.borderHairline }}
    >
      <View className="flex-row items-center mb-1.5">
        <Icon name="layers" size={12} color={colors.brandPrimary} style={{ marginRight: 6 }} />
        <Text variant="caption" className="font-uiSemiBold flex-1">The plan</Text>
        {longer && (
          <Text variant="caption" className="text-[11px]" style={{ color: colors.brandPrimary }}>
            {expanded ? "Less" : `${lines.length} steps`}
          </Text>
        )}
      </View>

      {shown.map((line, index) => (
        <Text
          key={index}
          variant="caption"
          className="text-[12px] leading-5"
          style={{ ...directionStyleFor(line), color: colors.inkSecondary }}
        >
          {line}
        </Text>
      ))}

      {longer && !expanded && (
        <Text variant="caption" className="text-[11px] mt-1 opacity-50">…</Text>
      )}
    </TouchableOpacity>
  );
};
