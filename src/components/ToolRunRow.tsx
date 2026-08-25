/**
 * frontend/src/components/ToolRunRow.tsx
 * ---------------------------------------------------------------------------
 * Terminal-style row for one agent tool call — the Claude Code / Cursor look:
 *
 *   ✓ edit   index.html                        +2 −2   1.1s
 *   ✓ read   src/app.js                      64 lines  0.4s
 *   ● bash   npm test                                  running
 *
 * Rows are meant to be stacked inside <ToolRunPanel> so a run reads as one
 * terminal session instead of scattered chips.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { MONO_FAMILY } from "../theme/mono";
import { type ColorTokens } from "../theme/theme";

export type ToolRunStatus = "running" | "completed" | "failed";

export interface ToolRunStep {
  tool: string;
  target?: string;
  status: ToolRunStatus;
  metrics?: Record<string, number> | null;
  durationMs?: number | null;
  error?: string;
}

/** Tool names and paths are always monospace, whatever the chat language. */
const MONO = MONO_FAMILY;

/** Names the role each token plays in the run log, so the JSX reads clearly. */
function palette(colors: ColorTokens) {
  return {
    panelBg: colors.surfaceCode,
    panelBorder: colors.borderHairline,
    tool: colors.inkPrimary,
    target: colors.inkSecondary,
    meta: colors.inkMuted,
    plus: colors.success,
    minus: colors.failed,
    ok: colors.success,
    fail: colors.failed,
    run: colors.warning,
    errorBg: colors.failedSoft,
  };
}

function formatDuration(ms?: number | null): string | null {
  if (ms == null || ms < 0) return null;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Container that makes stacked rows read as one terminal block. */
export const ToolRunPanel = ({
  isLight,
  children,
}: {
  isLight: boolean;
  children: React.ReactNode;
}) => {
  const { colors } = useTheme();
  const c = palette(colors);
  return (
    <View
      style={{
        backgroundColor: c.panelBg,
        borderColor: c.panelBorder,
        borderWidth: 1,
        borderRadius: 14,
        paddingVertical: 6,
        paddingHorizontal: 10,
        marginBottom: 12,
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
};

export const ToolRunRow = ({ step, isLight }: { step: ToolRunStep; isLight: boolean }) => {
  const { colors } = useTheme();
  const c = palette(colors);
  const isFailed = step.status === "failed";
  const isRunning = step.status === "running";

  const glyph = isFailed ? "✕" : isRunning ? "●" : "✓";
  const glyphColor = isFailed ? c.fail : isRunning ? c.run : c.ok;

  const m = step.metrics ?? undefined;
  const duration = formatDuration(step.durationMs);

  return (
    <View style={{ paddingVertical: 5 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ color: glyphColor, fontFamily: MONO, fontSize: 11, width: 14 }}>{glyph}</Text>

        <Text style={{ color: c.tool, fontFamily: MONO, fontSize: 12, fontWeight: "600" }}>
          {step.tool}
        </Text>

        {step.target ? (
          <Text
            numberOfLines={1}
            ellipsizeMode="middle"
            style={{ color: c.target, fontFamily: MONO, fontSize: 12, flex: 1, marginLeft: 8 }}
          >
            {step.target}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {/* Right-hand metrics: +/- for edits, counts for reads/searches */}
        {m?.plus != null && m.plus > 0 && (
          <Text style={{ color: c.plus, fontFamily: MONO, fontSize: 11, marginLeft: 8 }}>
            +{m.plus}
          </Text>
        )}
        {m?.minus != null && m.minus > 0 && (
          <Text style={{ color: c.minus, fontFamily: MONO, fontSize: 11, marginLeft: 4 }}>
            −{m.minus}
          </Text>
        )}
        {m?.lines != null && (
          <Text style={{ color: c.meta, fontFamily: MONO, fontSize: 11, marginLeft: 8 }}>
            {m.lines} lines
          </Text>
        )}
        {m?.matches != null && (
          <Text style={{ color: c.meta, fontFamily: MONO, fontSize: 11, marginLeft: 8 }}>
            {m.matches} matches
          </Text>
        )}
        {m?.entries != null && (
          <Text style={{ color: c.meta, fontFamily: MONO, fontSize: 11, marginLeft: 8 }}>
            {m.entries} items
          </Text>
        )}

        <Text style={{ color: c.meta, fontFamily: MONO, fontSize: 11, marginLeft: 8 }}>
          {isRunning ? "running…" : duration ?? ""}
        </Text>
      </View>

      {isFailed && step.error ? (
        <View
          style={{
            backgroundColor: c.errorBg,
            borderRadius: 8,
            paddingVertical: 6,
            paddingHorizontal: 8,
            marginTop: 6,
            marginLeft: 14,
          }}
        >
          <Text numberOfLines={3} style={{ color: c.fail, fontFamily: MONO, fontSize: 11, lineHeight: 16 }}>
            {step.error}
          </Text>
        </View>
      ) : null}
    </View>
  );
};
