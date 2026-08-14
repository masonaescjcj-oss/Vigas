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

export type ToolRunStatus = "running" | "completed" | "failed";

export interface ToolRunStep {
  tool: string;
  target?: string;
  status: ToolRunStatus;
  metrics?: Record<string, number> | null;
  durationMs?: number | null;
  error?: string;
}

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

function palette(isLight: boolean) {
  return {
    panelBg: isLight ? "#F8FAFC" : "#0B0B0D",
    panelBorder: isLight ? "#E2E8F0" : "#1F1F23",
    tool: isLight ? "#0F172A" : "#E4E4E7",
    target: isLight ? "#64748B" : "#8B8B93",
    meta: isLight ? "#94A3B8" : "#5F5F66",
    plus: isLight ? "#16A34A" : "#4ADE80",
    minus: isLight ? "#DC2626" : "#F87171",
    ok: isLight ? "#16A34A" : "#4ADE80",
    fail: isLight ? "#DC2626" : "#F87171",
    run: isLight ? "#D97706" : "#FBBF24",
    errorBg: isLight ? "#FEF2F2" : "#2A1214",
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
  const c = palette(isLight);
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
  const c = palette(isLight);
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
