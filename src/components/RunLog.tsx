/**
 * frontend/src/components/RunLog.tsx
 * ---------------------------------------------------------------------------
 * The run log, revealed a row at a time.
 *
 * A component rather than the hook at the call site because the chat renders
 * these inside a map over messages, and a hook cannot be called in a loop.
 * Giving each panel its own component gives each run its own reveal state,
 * which is also what makes the high-water mark work per message.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { ToolRunPanel, ToolRunRow, type ToolRunStep } from "./ToolRunRow";
import { useStaggered } from "../hooks/useStaggered";

export const RunLog: React.FC<{
  steps: ToolRunStep[];
  isLight: boolean;
  /** False for restored history — replaying a finished run is theatre. */
  animate: boolean;
}> = ({ steps, isLight, animate }) => {
  const shown = useStaggered(steps.length, animate);
  if (steps.length === 0) return null;

  return (
    <ToolRunPanel isLight={isLight} reveal={animate ? shown : 0}>
      {steps.map((step, index) => (
        <ToolRunRow key={index} step={step} isLight={isLight} />
      ))}
    </ToolRunPanel>
  );
};
