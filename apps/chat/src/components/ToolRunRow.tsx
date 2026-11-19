/**
 * frontend/src/components/ToolRunRow.tsx
 * ---------------------------------------------------------------------------
 * What the agent did, printed on a strip of paper.
 *
 *   ✓ RUN · 6 STEPS                                   48s  hide ⌃
 *   ─────────────────────────────────────────────────────────────
 *   ✓ wrote   src/App.tsx                                   +84
 *   ✓ ran     npm install                                 12.4s
 *   ● start   dev server                                      …
 *
 * A printing calculator's tape: the record of each operation, in order, on
 * paper that stays paper whatever theme the app is in. Perforated at both
 * ends, torn off when the run finishes — it folds to its header line, and a
 * tap unrolls it again.
 *
 * Verbs are what a person would say ("wrote", "ran"), not the tool's internal
 * name ("write_file", "bash"); anything unrecognised falls back to the raw name
 * so a new tool is never hidden.
 * ---------------------------------------------------------------------------
 */

import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Icon } from "./Icon";
import { useTheme } from "../theme/ThemeProvider";
import { monoFamily } from "../theme/mono";
import { TAPE } from "../theme/device";
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

function formatDuration(ms?: number | null): string | null {
  if (ms == null || ms < 0) return null;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

/** The agent's tool names in the words a person would use. */
const VERB: Record<string, [done: string, running: string]> = {
  read: ["read", "read"],
  read_file: ["read", "read"],
  write: ["wrote", "write"],
  write_file: ["wrote", "write"],
  edit: ["edited", "edit"],
  edit_file: ["edited", "edit"],
  bash: ["ran", "run"],
  shell: ["ran", "run"],
  run: ["ran", "run"],
  search: ["searched", "search"],
  grep: ["searched", "search"],
  glob: ["listed", "list"],
  list: ["listed", "list"],
  list_files: ["listed", "list"],
  delete: ["deleted", "delete"],
  delete_file: ["deleted", "delete"],
  install: ["installed", "install"],
  dev_server: ["started", "start"],
  start_dev_server: ["started", "start"],
  enter_plan_mode: ["planned", "plan"],
  todo_write: ["listed", "list"],
  ask_user: ["asked", "ask"],
  supabase: ["set up", "set up"],
};

function verbFor(tool: string, running: boolean): string {
  const pair = VERB[tool] ?? VERB[tool.toLowerCase()];
  if (!pair) return tool;
  return running ? pair[1] : pair[0];
}

/**
 * A torn, perforated edge: a row of half-holes in the colour of whatever the
 * tape is lying on. Clipped by the tape's own overflow, so only the inner half
 * of each hole shows.
 */
const Perforation: React.FC<{ edge: "top" | "bottom"; color: string }> = ({ edge, color }) => (
  <View
    pointerEvents="none"
    style={{ position: "absolute", left: 0, right: 0, [edge]: -4, height: 8, flexDirection: "row", overflow: "hidden" }}
  >
    {Array.from({ length: 90 }, (_, i) => (
      <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginLeft: i === 0 ? 1 : 2 }} />
    ))}
  </View>
);

/**
 * The mark at the start of a line: a tick, a cross, or a lit dot for the step
 * in progress. Drawn rather than typed — Plex Mono has no ✓, and the fallback
 * each platform picks renders it as anything from a tick to a square-root sign.
 */
const Mark: React.FC<{ status: "ok" | "fail" | "run"; runColor: string }> = ({ status, runColor }) => (
  <View style={{ width: 18, alignItems: "flex-start", justifyContent: "center" }}>
    {status === "run" ? (
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: runColor }} />
    ) : (
      <Icon name={status === "ok" ? "check" : "x"} size={12} color={status === "ok" ? TAPE.ok : TAPE.fail} strokeWidth={2.5} />
    )}
  </View>
);

/**
 * The strip.
 *
 * `reveal` prints rows one at a time. A run's steps are read in a single poll,
 * so without it a minute of work appears in one frame and reads as a page that
 * finished loading rather than as something that happened. Pass 0 to show
 * everything at once — restored history should not replay.
 */
export const ToolRunPanel = ({
  children,
  reveal = 0,
  steps,
}: {
  /** Kept for the call sites that still pass it; paper is paper in every theme. */
  isLight?: boolean;
  children: React.ReactNode;
  /** Rows to show. 0 means all of them. */
  reveal?: number;
  steps?: ToolRunStep[];
}) => {
  const { colors } = useTheme();
  const mono = monoFamily();
  const monoMedium = monoFamily("medium");

  const running = steps?.some((s) => s.status === "running") ?? false;
  const failed = steps?.some((s) => s.status === "failed") ?? false;
  const total = steps?.length ?? 0;
  const totalMs = steps?.reduce((sum, s) => sum + (s.durationMs ?? 0), 0) ?? 0;

  // Unrolled while the agent is working; torn off to its header once it is
  // done. A run that finishes while you watch folds itself away.
  const [open, setOpen] = useState(running);
  const wasRunning = useRef(running);
  useEffect(() => {
    if (wasRunning.current && !running) setOpen(false);
    wasRunning.current = running;
  }, [running]);

  const rows = React.Children.toArray(children);
  const shown = reveal > 0 ? rows.slice(0, reveal) : rows;

  const headline = running ? "RUN · WORKING" : `RUN · ${total} STEP${total === 1 ? "" : "S"}`;

  return (
    <View style={{ backgroundColor: TAPE.paper, borderRadius: 3, overflow: "hidden", marginBottom: 14 }}>
      <Perforation edge="top" color={colors.canvasBase} />

      <Pressable
        onPress={() => { selectionFeedback(); setOpen((v) => !v); }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${headline}. ${open ? "Hide" : "Show"} the steps`}
        style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: open ? 10 : 15 }}
      >
        <Mark status={running ? "run" : failed ? "fail" : "ok"} runColor={colors.brandEdge} />
        <Text style={{ fontFamily: monoMedium, fontSize: 11.5, letterSpacing: 0.8, color: TAPE.ink, flex: 1 }}>{headline}</Text>
        {!running && totalMs > 0 ? (
          <Text style={{ fontFamily: mono, fontSize: 11.5, color: TAPE.muted, marginRight: 10 }}>{formatDuration(totalMs)}</Text>
        ) : null}
        <Text style={{ fontFamily: mono, fontSize: 11.5, color: TAPE.muted, marginRight: 4 }}>{open ? "hide" : "show tape"}</Text>
        <Icon
          name="chevron-down"
          size={13}
          color={TAPE.muted}
          style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
        />
      </Pressable>

      {open && shown.length > 0 ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <View style={{ height: 1, backgroundColor: TAPE.rule, marginBottom: 8 }} />
          {shown}
        </View>
      ) : null}

      <Perforation edge="bottom" color={colors.canvasBase} />
    </View>
  );
};

export const ToolRunRow = ({ step }: { step: ToolRunStep; isLight?: boolean }) => {
  const { colors } = useTheme();
  const mono = monoFamily();
  const isFailed = step.status === "failed";
  const isRunning = step.status === "running";

  const m = step.metrics ?? undefined;
  const duration = formatDuration(step.durationMs);
  const meta = { color: TAPE.muted, fontFamily: mono, fontSize: 11.5, marginLeft: 8 };


  return (
    <View style={{ paddingVertical: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Mark status={isRunning ? "run" : isFailed ? "fail" : "ok"} runColor={colors.brandEdge} />
        <Text style={{ fontFamily: mono, fontSize: 12, color: TAPE.ink, width: 60 }} numberOfLines={1}>
          {verbFor(step.tool, isRunning)}
        </Text>

        {step.target ? (
          <Text
            numberOfLines={1}
            ellipsizeMode="middle"
            style={{ fontFamily: mono, fontSize: 12, color: TAPE.ink, flex: 1 }}
          >
            {step.target}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {m?.plus != null && m.plus > 0 ? <Text style={{ ...meta, color: TAPE.ok }}>+{m.plus}</Text> : null}
        {m?.minus != null && m.minus > 0 ? <Text style={{ ...meta, color: TAPE.fail, marginLeft: 4 }}>−{m.minus}</Text> : null}
        {m?.lines != null ? <Text style={meta}>{m.lines} ln</Text> : null}
        {m?.matches != null ? <Text style={meta}>{m.matches} hits</Text> : null}
        {m?.entries != null ? <Text style={meta}>{m.entries} items</Text> : null}
        {isRunning ? <Text style={meta}>…</Text> : duration ? <Text style={meta}>{duration}</Text> : null}
      </View>

      {isFailed && step.error ? (
        <View style={{ backgroundColor: TAPE.failSoft, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 8, marginTop: 6, marginLeft: 18 }}>
          <Text numberOfLines={3} style={{ color: TAPE.fail, fontFamily: mono, fontSize: 11, lineHeight: 16 }}>
            {step.error}
          </Text>
        </View>
      ) : null}
    </View>
  );
};
