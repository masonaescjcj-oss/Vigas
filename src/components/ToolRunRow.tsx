/**
 * frontend/src/components/ToolRunRow.tsx
 * ---------------------------------------------------------------------------
 * What the agent did, as a list of steps.
 *
 *   Built 5 steps                                   48s  ⌄
 *   ✓ Edited   index.html                        +2 −2
 *   ✓ Read     src/app.js                      64 lines
 *   ● Running  npm test
 *
 * It was a terminal transcript — monospace glyphs on a near-black panel, the
 * tool's internal name ("bash", "edit") as the verb. A phone is not a
 * terminal. The panel is now a card like every other card in the app, the
 * header says how much was done and can fold the detail away, and each row
 * leads with a plain verb. Paths and commands stay monospace, because they
 * are code.
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Icon } from "./Icon";
import { useTheme } from "../theme/ThemeProvider";
import { MONO_FAMILY } from "../theme/mono";
import { selectionFeedback } from "../services/haptics";

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

function formatDuration(ms?: number | null): string | null {
  if (ms == null || ms < 0) return null;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

/**
 * The agent's tool names, in the past tense a person would use. Anything not
 * listed falls back to the raw name, so a new tool is never hidden.
 */
const VERB: Record<string, [done: string, running: string]> = {
  read: ["Read", "Reading"],
  read_file: ["Read", "Reading"],
  write: ["Wrote", "Writing"],
  write_file: ["Wrote", "Writing"],
  edit: ["Edited", "Editing"],
  edit_file: ["Edited", "Editing"],
  bash: ["Ran", "Running"],
  shell: ["Ran", "Running"],
  run: ["Ran", "Running"],
  search: ["Searched", "Searching"],
  grep: ["Searched", "Searching"],
  glob: ["Listed", "Listing"],
  list: ["Listed", "Listing"],
  list_files: ["Listed", "Listing"],
  delete: ["Deleted", "Deleting"],
  delete_file: ["Deleted", "Deleting"],
  install: ["Installed", "Installing"],
  dev_server: ["Started", "Starting"],
  start_dev_server: ["Started", "Starting"],
  enter_plan_mode: ["Planned", "Planning"],
  todo_write: ["Listed the work", "Listing the work"],
  ask_user: ["Asked", "Asking"],
  supabase: ["Set up backend", "Setting up backend"],
};

function verbFor(tool: string, running: boolean): string {
  const pair = VERB[tool] ?? VERB[tool.toLowerCase()];
  if (!pair) return tool;
  return running ? pair[1] : pair[0];
}

/**
 * The card around the rows.
 *
 * `reveal` shows rows one at a time. A run's steps are read in a single poll,
 * so without it a minute of work appears in one frame and reads as a page that
 * finished loading rather than as something that happened. Pass 0 to show
 * everything at once — restored history should not replay.
 *
 * `steps`, when given, draws the summary header; without it the card is just
 * the rows, which is what the older call sites want.
 */
export const ToolRunPanel = ({
  children,
  reveal = 0,
  steps,
}: {
  /** Kept for the call sites that still pass it; colour comes from the theme. */
  isLight?: boolean;
  children: React.ReactNode;
  /** Rows to show. 0 means all of them. */
  reveal?: number;
  steps?: ToolRunStep[];
}) => {
  const { colors } = useTheme();
  const [open, setOpen] = useState(true);

  const rows = React.Children.toArray(children);
  const shown = reveal > 0 ? rows.slice(0, reveal) : rows;

  const running = steps?.some((s) => s.status === "running") ?? false;
  const failed = steps?.some((s) => s.status === "failed") ?? false;
  const total = steps?.length ?? 0;
  const totalMs = steps?.reduce((sum, s) => sum + (s.durationMs ?? 0), 0) ?? 0;

  const headline = running
    ? "Working…"
    : failed
      ? "Stopped on a step"
      : `${total} step${total === 1 ? "" : "s"}`;

  return (
    <View
      style={{
        backgroundColor: colors.surfaceRaised,
        borderColor: colors.borderHairline,
        borderWidth: 1,
        borderRadius: 14,
        marginBottom: 12,
        overflow: "hidden",
      }}
    >
      {steps ? (
        <TouchableOpacity
          onPress={() => { selectionFeedback(); setOpen((v) => !v); }}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          activeOpacity={0.6}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            paddingVertical: 9,
            borderBottomWidth: open && shown.length > 0 ? 1 : 0,
            borderBottomColor: colors.borderHairline,
          }}
        >
          {running ? (
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brandPrimary, marginRight: 9 }} />
          ) : (
            <Icon name={failed ? "x" : "check"} size={13} color={failed ? colors.failed : colors.success} style={{ marginRight: 7 }} />
          )}
          <Text style={{ color: colors.inkPrimary, fontSize: 13, fontWeight: "500", flex: 1 }}>{headline}</Text>
          {!running && totalMs > 0 ? (
            <Text style={{ color: colors.inkMuted, fontSize: 11.5, fontVariant: ["tabular-nums"], marginRight: 8 }}>
              {formatDuration(totalMs)}
            </Text>
          ) : null}
          <Icon
            name="chevron-down"
            size={14}
            color={colors.inkMuted}
            style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
          />
        </TouchableOpacity>
      ) : null}

      {open ? <View style={{ paddingVertical: 4, paddingHorizontal: 12 }}>{shown}</View> : null}
    </View>
  );
};

export const ToolRunRow = ({ step }: { step: ToolRunStep; isLight?: boolean }) => {
  const { colors } = useTheme();
  const isFailed = step.status === "failed";
  const isRunning = step.status === "running";

  const m = step.metrics ?? undefined;
  const duration = formatDuration(step.durationMs);
  const meta = { color: colors.inkMuted, fontFamily: MONO, fontSize: 11, marginLeft: 8 };

  return (
    <View style={{ paddingVertical: 5 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ width: 18, alignItems: "flex-start" }}>
          {isRunning ? (
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brandPrimary }} />
          ) : (
            <Icon name={isFailed ? "x" : "check"} size={12} color={isFailed ? colors.failed : colors.success} />
          )}
        </View>

        <Text style={{ color: colors.inkPrimary, fontSize: 12.5, fontWeight: "500" }}>
          {verbFor(step.tool, isRunning)}
        </Text>

        {step.target ? (
          <Text
            numberOfLines={1}
            ellipsizeMode="middle"
            style={{ color: colors.inkSecondary, fontFamily: MONO, fontSize: 11.5, flex: 1, marginLeft: 8 }}
          >
            {step.target}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {/* Right-hand metrics: +/- for edits, counts for reads/searches */}
        {m?.plus != null && m.plus > 0 && (
          <Text style={{ ...meta, color: colors.success }}>+{m.plus}</Text>
        )}
        {m?.minus != null && m.minus > 0 && (
          <Text style={{ ...meta, color: colors.failed, marginLeft: 4 }}>−{m.minus}</Text>
        )}
        {m?.lines != null && <Text style={meta}>{m.lines} lines</Text>}
        {m?.matches != null && <Text style={meta}>{m.matches} matches</Text>}
        {m?.entries != null && <Text style={meta}>{m.entries} items</Text>}

        {!isRunning && duration ? <Text style={meta}>{duration}</Text> : null}
      </View>

      {isFailed && step.error ? (
        <View
          style={{
            backgroundColor: colors.failedSoft,
            borderRadius: 8,
            paddingVertical: 6,
            paddingHorizontal: 8,
            marginTop: 6,
            marginLeft: 18,
          }}
        >
          <Text numberOfLines={3} style={{ color: colors.failed, fontFamily: MONO, fontSize: 11, lineHeight: 16 }}>
            {step.error}
          </Text>
        </View>
      ) : null}
    </View>
  );
};
