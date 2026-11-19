/**
 * frontend/src/components/CopyButton.tsx
 * ---------------------------------------------------------------------------
 * A small "copy this" control.
 *
 * It confirms in place rather than with a toast. On a phone the thing you copied
 * is under your thumb, and a banner at the top of the screen is the wrong place
 * to look for confirmation of a tap you just made at the bottom.
 * ---------------------------------------------------------------------------
 */

import React, { useEffect, useRef, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { Text } from "./Typography";
import { Icon } from "./Icon";
import { useTheme } from "../theme/ThemeProvider";
import { copyText } from "../services/clipboard";
import { errorFeedback, successFeedback } from "../services/haptics";

/** Long enough to notice, short enough not to hide the button. */
const CONFIRM_MS = 1600;

export const CopyButton = ({
  value,
  label,
  compact = false,
}: {
  value: string;
  /** Shown next to the icon. Omit for an icon-only button. */
  label?: string;
  compact?: boolean;
}) => {
  const { colors } = useTheme();
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A press followed by an unmount — scrolling a long answer away, say — would
  // otherwise set state on a gone component.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const handlePress = async () => {
    const ok = await copyText(value);
    if (ok) successFeedback();
    else errorFeedback();
    setState(ok ? "done" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), CONFIRM_MS);
  };

  const tint = state === "done"
    ? colors.success
    : state === "failed"
      ? colors.failed
      : colors.inkMuted;

  const text = state === "done" ? "Copied" : state === "failed" ? "Can't copy" : label;

  return (
    <TouchableOpacity
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label ? `Copy ${label}` : "Copy"}
      // A code block's copy button is small by nature, so the touch target is
      // padded out beyond the visible pill.
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: compact ? 6 : 8,
        paddingVertical: compact ? 3 : 5,
        borderRadius: 8,
        backgroundColor: colors.surfaceMuted,
      }}
      activeOpacity={0.7}
    >
      <Icon name={state === "done" ? "check" : "copy"} size={compact ? 11 : 12} color={tint} />
      {text ? (
        <View style={{ marginLeft: 5 }}>
          <Text style={{ color: tint, fontSize: compact ? 10 : 11 }} className="font-uiMedium">
            {text}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
};
