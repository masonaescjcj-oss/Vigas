/**
 * frontend/src/components/AnimatedAgentText.tsx
 * ---------------------------------------------------------------------------
 * An agent message that types itself in, then behaves exactly like the static
 * one.
 *
 * The markdown renderer is unchanged and receives progressively longer text —
 * so a code fence that is still half-written renders as the paragraph it
 * currently is, and settles into a code block when its closing fence arrives.
 * That is the tradeoff for not reimplementing the renderer: brief reflow while
 * a fence completes, in exchange for one code path for formatting.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { AgentMessageText } from "./AgentMessageText";
import { useTypewriter } from "../hooks/useTypewriter";

interface AnimatedAgentTextProps {
  /** Stable per message; the reveal keys on it and runs once. */
  id: string;
  content: string;
  /** False for restored history — replaying an old chat is theatre. */
  animate: boolean;
  isLight: boolean;
  textColor: string;
}

export const AnimatedAgentText: React.FC<AnimatedAgentTextProps> = ({
  id,
  content,
  animate,
  isLight,
  textColor,
}) => {
  const { visible } = useTypewriter(id, content, animate);
  return <AgentMessageText content={visible} isLight={isLight} textColor={textColor} />;
};
