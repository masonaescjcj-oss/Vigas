/**
 * frontend/src/components/ModelMarks.tsx
 * ---------------------------------------------------------------------------
 * Icons for the model picker.
 *
 * Not vendor logos, deliberately. The provider is an aggregator, and two of the
 * three model names in the catalogue are not products of the companies their
 * names evoke — "GPT-5.6 Luna" is not an OpenAI model and DeepSeek ships no
 * "V4 Flash". Putting those companies' marks on them would tell a user they are
 * getting something the routing does not show they are getting, which is a
 * false claim before it is a trademark problem.
 *
 * So each mark describes what the model *does*. Drawn as one family — same
 * 24×24 grid, same stroke weight, a shared "core plus surround" motif — so the
 * picker reads as a designed set rather than four unrelated glyphs.
 *
 * Same props as the lucide icons they sit beside, so Icon.tsx can register them
 * without a special case.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import Svg, { Circle, Path } from "react-native-svg";

interface MarkProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const BASE = { width: 24, height: 24, viewBox: "0 0 24 24" };

/** Auto — a spark: the server chooses, so nothing more specific is promised. */
export const ModelAuto = ({ size = 24, color = "currentColor", strokeWidth = 2 }: MarkProps) => (
  <Svg {...BASE} width={size} height={size} fill="none">
    <Path
      d="M12 3.5 L13.6 10.4 L20.5 12 L13.6 13.6 L12 20.5 L10.4 13.6 L3.5 12 L10.4 10.4 Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
  </Svg>
);

/** Fast — a bolt through the core. */
export const ModelFast = ({ size = 24, color = "currentColor", strokeWidth = 2 }: MarkProps) => (
  <Svg {...BASE} width={size} height={size} fill="none">
    <Path
      d="M13.8 2.5 L5.5 13.2 h5.2 l-.5 8.3 L18.5 10.8 h-5.2 z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
  </Svg>
);

/** Economical — a small core with speed lines: cheap and quick, not deep. */
export const ModelEconomical = ({ size = 24, color = "currentColor", strokeWidth = 2 }: MarkProps) => (
  <Svg {...BASE} width={size} height={size} fill="none">
    <Circle cx="16" cy="12" r="3.6" stroke={color} strokeWidth={strokeWidth} />
    <Path
      d="M2.5 7.5 h6 M1.5 12 h4.5 M2.5 16.5 h6"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </Svg>
);

/** Reasoning — a core wrapped in layers: it thinks further before answering. */
export const ModelReasoning = ({ size = 24, color = "currentColor", strokeWidth = 2 }: MarkProps) => (
  <Svg {...BASE} width={size} height={size} fill="none">
    <Circle cx="12" cy="12" r="2" fill={color} />
    <Circle cx="12" cy="12" r="5.8" stroke={color} strokeWidth={strokeWidth} opacity={0.75} />
    <Circle cx="12" cy="12" r="9.6" stroke={color} strokeWidth={strokeWidth} opacity={0.45} />
  </Svg>
);

/** Frontier — the densest core, for whatever sits at the top of the catalogue. */
export const ModelFrontier = ({ size = 24, color = "currentColor", strokeWidth = 2 }: MarkProps) => (
  <Svg {...BASE} width={size} height={size} fill="none">
    <Path
      d="M12 2.5 L20.5 7.25 v9.5 L12 21.5 L3.5 16.75 v-9.5 Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
    <Circle cx="12" cy="12" r="2.6" fill={color} />
  </Svg>
);
